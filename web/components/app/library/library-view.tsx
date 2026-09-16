"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, useReducedMotion } from "motion/react";
import {
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  SearchX,
  Send,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/app/empty-state";
import { SectionHeader } from "@/components/app/section-header";
import { StatePanel } from "@/components/app/state-panel";
import { BookDetailDialog } from "@/components/app/library/book-detail-dialog";
import { DeliverDialog } from "@/components/app/library/deliver-dialog";
import {
  filterAndSortLibraryItems,
  type SortBy,
  type SourceFilter,
} from "@/components/app/library/library-collection";
import {
  LibraryCoverImage,
  SearchCoverImage,
} from "@/components/app/library/cover-image";
import { UploadDropzone } from "@/components/app/library/upload-dropzone";
import { EmptyLibraryIllustration } from "@/components/illustrations";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { ApiError, useApiClient } from "@/lib/api-client";
import { useGatewayJob } from "@/lib/use-gateway-job";
import { cn } from "@/lib/utils";
import type { Device, LibraryItem, PaginatedLibraryItems, SearchResult } from "@/lib/types";

type ViewMode = "grid" | "list";
type AddTab = "import" | "search";

function formatAppDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
  }).format(new Date(iso));
}

function mapFetchError(
  error: string | null,
  t: ReturnType<typeof useTranslations<"library">>
): string {
  if (!error) return t("toastFetchFailed");
  if (/abandonn[ée] après \d+ tentatives/i.test(error) || /abandoned after \d+ attempts/i.test(error)) {
    return t("toastFetchAbandoned");
  }
  if (/malveillant|VirusTotal/i.test(error)) return t("toastFetchMalicious");
  if (/volumineux|too large/i.test(error)) return t("toastFetchTooLarge");
  if (/espace est plein|storage is full/i.test(error)) return t("toastAddQuota");
  if (/livre reconnu|Formats acceptés|not a recognized/i.test(error)) {
    return t("toastFetchBadFormat");
  }
  if (/revoked/i.test(error)) return t("toastFetchRevoked");
  return t("toastFetchFailed");
}

function PendingFetchTracker({
  resultKey,
  jobId,
  onDone,
  onFailed,
  onTimeout,
}: {
  resultKey: string;
  jobId: string;
  onDone: (resultKey: string, libraryItemId: string | null) => void;
  onFailed: (resultKey: string, error: string | null) => void;
  onTimeout: (resultKey: string) => void;
}) {
  const { status, libraryItemId, error } = useGatewayJob(jobId);
  const settled = useRef(false);

  useEffect(() => {
    if (settled.current) return;
    if (status === "done") {
      settled.current = true;
      onDone(resultKey, libraryItemId);
    } else if (status === "failed") {
      settled.current = true;
      onFailed(resultKey, error);
    } else if (status === "timeout") {
      settled.current = true;
      onTimeout(resultKey);
    }
  }, [status, libraryItemId, error, resultKey, onDone, onFailed, onTimeout]);

  return null;
}

function SearchResultActions({
  result,
  resultKey,
  isPending,
  addingId,
  onAdd,
  t,
}: {
  result: SearchResult;
  resultKey: string;
  isPending: boolean;
  addingId: string | null;
  onAdd: (result: SearchResult) => void;
  t: ReturnType<typeof useTranslations<"library">>;
}) {
  if (result.owned) {
    return (
      <Button size="sm" variant="secondary" disabled>
        {t("inLibrary")}
      </Button>
    );
  }
  if (isPending) {
    return (
      <Button size="sm" variant="outline" disabled>
        <Loader2 className="animate-spin" />
        {t("fetching")}
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      disabled={addingId === resultKey}
      onClick={() => onAdd(result)}
    >
      {addingId === resultKey ? <Loader2 className="animate-spin" /> : null}
      {t("add")}
    </Button>
  );
}

function BookActions({
  item,
  canDeliver,
  onDetails,
  onDeliver,
  t,
  fullWidth,
}: {
  item: LibraryItem;
  canDeliver: boolean;
  onDetails: (item: LibraryItem) => void;
  onDeliver: (item: LibraryItem) => void;
  t: ReturnType<typeof useTranslations<"library">>;
  fullWidth?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", fullWidth && "w-full")}>
      {canDeliver ? (
        <Button
          size="sm"
          className={fullWidth ? "min-w-0 flex-1" : undefined}
          aria-label={t("deliverOf", { title: item.title })}
          onClick={() => onDeliver(item)}
        >
          <Send />
          {t("deliver")}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant={canDeliver ? "ghost" : "outline"}
        className={fullWidth && !canDeliver ? "w-full" : fullWidth ? "min-w-0 flex-1" : undefined}
        aria-label={t("detailsOf", { title: item.title })}
        onClick={() => onDetails(item)}
      >
        {t("details")}
      </Button>
    </div>
  );
}

export function LibraryView({
  title,
  description,
  initialItems,
  itemsUnavailable,
  itemsPartial,
  devices,
}: {
  title: string;
  description: string;
  initialItems: LibraryItem[];
  itemsUnavailable: boolean;
  itemsPartial: boolean;
  devices: Device[];
}) {
  const t = useTranslations("library");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { call } = useApiClient();
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const addSectionRef = useRef<HTMLElement>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [pendingJobs, setPendingJobs] = useState<Record<string, string>>({});
  const [items, setItems] = useState(initialItems);
  const [detailItem, setDetailItem] = useState<LibraryItem | null>(null);
  const [deliverItem, setDeliverItem] = useState<LibraryItem | null>(null);
  const [retrying, setRetrying] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortBy>("added");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const [addOpen, setAddOpen] = useState(initialItems.length === 0 && !itemsUnavailable);
  const [addTab, setAddTab] = useState<AddTab>("import");

  const canDeliver = devices.length > 0;

  const languages = useMemo(
    () => Array.from(new Set(items.map((item) => item.language).filter((v): v is string => !!v))),
    [items]
  );
  const formats = useMemo(
    () => Array.from(new Set(items.map((item) => item.original_format))),
    [items]
  );

  const displayedItems = useMemo(
    () =>
      filterAndSortLibraryItems(items, {
        languageFilter,
        formatFilter,
        sourceFilter,
        sortBy,
      }),
    [items, languageFilter, formatFilter, sourceFilter, sortBy]
  );

  function openAdd(tab: AddTab = "import") {
    setAddTab(tab);
    setAddOpen(true);
    requestAnimationFrame(() => {
      addSectionRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  function markOwned(resultKey: string) {
    const [source, ...rest] = resultKey.split(":");
    const resultId = rest.join(":");
    setResults((prev) =>
      prev
        ? prev.map((candidate) =>
            candidate.source === source && candidate.result_id === resultId
              ? { ...candidate, owned: true }
              : candidate
          )
        : prev
    );
  }

  function clearPending(resultKey: string) {
    setPendingJobs((prev) => {
      const next = { ...prev };
      delete next[resultKey];
      return next;
    });
  }

  async function handleFetchDone(resultKey: string) {
    clearPending(resultKey);
    markOwned(resultKey);
    try {
      const refreshed = await call<PaginatedLibraryItems>("/api/v1/books?page=1&limit=200");
      const itemsAcc = [...refreshed.items];
      const totalPages = Math.max(1, Math.ceil(refreshed.total / refreshed.limit));
      for (let page = 2; page <= totalPages; page += 1) {
        try {
          const next = await call<PaginatedLibraryItems>(`/api/v1/books?page=${page}&limit=200`);
          itemsAcc.push(...next.items);
        } catch {
          break;
        }
      }
      setItems(itemsAcc);
    } catch {
      // Owned badge + toast still apply even if library refresh fails.
    }
    toast.success(t("toastFetchArrived"));
  }

  function handleFetchFailed(resultKey: string, error: string | null) {
    clearPending(resultKey);
    const cause = mapFetchError(error, t);
    const generic = t("toastFetchFailed");
    if (cause === generic) {
      toast.error(generic);
    } else {
      toast.error(generic, { description: cause });
    }
  }

  function handleFetchTimeout(resultKey: string) {
    clearPending(resultKey);
    toast.error(t("toastFetchFailed"), { description: t("toastFetchTimeout") });
  }

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const found = await call<SearchResult[]>("/api/v1/books/search", {
        method: "POST",
        body: JSON.stringify({ query, scope: ["legal", "gateways"] }),
      });
      setResults(found);
    } catch {
      toast.error(t("toastSearchFailed"));
    } finally {
      setSearching(false);
    }
  }

  async function addResult(result: SearchResult) {
    const resultKey = `${result.source}:${result.result_id}`;
    setAddingId(resultKey);
    try {
      const added = await call<LibraryItem | { gateway_job_id: string }>("/api/v1/books", {
        method: "POST",
        body: JSON.stringify({
          source: result.source,
          result_id: result.result_id,
          result,
        }),
      });
      if ("gateway_job_id" in added) {
        setPendingJobs((prev) => ({ ...prev, [resultKey]: added.gateway_job_id }));
      } else {
        setItems((prev) => [added, ...prev]);
        toast.success(t("toastAdded", { title: added.title }));
        markOwned(resultKey);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 507) {
        toast.error(t("toastAddQuota"));
      } else {
        toast.error(t("toastAddFailed"));
      }
    } finally {
      setAddingId(null);
    }
  }

  function sourceBadgeLabel(item: LibraryItem) {
    const ref = item.source_ref;
    if (!ref) return t("sourceManual");
    if (ref.startsWith("gateway:")) return t("sourceLinked");
    if (ref.startsWith("gutenberg:")) return t("sourceGutenberg");
    if (ref.startsWith("standard_ebooks:")) return t("sourceStandardEbooks");
    return t("sourceManual");
  }

  function sourceLabel(source: string) {
    if (source === "gutenberg") return t("sourceGutenberg");
    if (source === "standard_ebooks") return t("sourceStandardEbooks");
    if (source === "upload") return t("sourceManual");
    if (source.startsWith("gateway:")) return t("sourceLinked");
    return source;
  }

  function resetFilters() {
    setLanguageFilter("all");
    setFormatFilter("all");
    setSourceFilter("all");
  }

  function handleRetry() {
    setRetrying(true);
    router.refresh();
  }

  const filterControls = (
    <div
      className="flex flex-wrap items-end gap-x-4 gap-y-3"
      role="group"
      aria-label={t("filtersLabel")}
    >
      <div className="space-y-1.5">
        <Label htmlFor="library-sort" className="text-xs text-muted-foreground">
          {t("sortLabel")}
        </Label>
        <Select value={sortBy} onValueChange={(value) => setSortBy((value as SortBy) ?? "added")}>
          <SelectTrigger id="library-sort" size="sm" className="min-w-36 border-border/50 bg-background/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="added">{t("sortAdded")}</SelectItem>
            <SelectItem value="title">{t("sortTitle")}</SelectItem>
            <SelectItem value="author">{t("sortAuthor")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {languages.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="library-language" className="text-xs text-muted-foreground">
            {t("filterLanguageLabel")}
          </Label>
          <Select value={languageFilter} onValueChange={(value) => setLanguageFilter(value ?? "all")}>
            <SelectTrigger id="library-language" size="sm" className="min-w-32 border-border/50 bg-background/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterLanguageAll")}</SelectItem>
              {languages.map((language) => (
                <SelectItem key={language} value={language}>
                  {language}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {formats.length > 1 && (
        <div className="space-y-1.5">
          <Label htmlFor="library-format" className="text-xs text-muted-foreground">
            {t("filterFormatLabel")}
          </Label>
          <Select value={formatFilter} onValueChange={(value) => setFormatFilter(value ?? "all")}>
            <SelectTrigger id="library-format" size="sm" className="min-w-32 border-border/50 bg-background/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterFormatAll")}</SelectItem>
              {formats.map((format) => (
                <SelectItem key={format} value={format}>
                  {format.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="library-source" className="text-xs text-muted-foreground">
          {t("filterSourceLabel")}
        </Label>
        <Select
          value={sourceFilter}
          onValueChange={(value) => setSourceFilter((value as SourceFilter) ?? "all")}
        >
          <SelectTrigger id="library-source" size="sm" className="min-w-36 border-border/50 bg-background/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterSourceAll")}</SelectItem>
            <SelectItem value="linked">{t("sourceLinked")}</SelectItem>
            <SelectItem value="manual">{t("sourceManual")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div
        className="ml-auto flex gap-0.5 rounded-lg bg-background/50 p-0.5 ring-1 ring-border/40"
        role="group"
        aria-label={t("viewModeLabel")}
      >
        <Button
          size="icon-sm"
          variant={viewMode === "grid" ? "secondary" : "ghost"}
          onClick={() => setViewMode("grid")}
          aria-label={t("gridView")}
          aria-pressed={viewMode === "grid"}
        >
          <LayoutGrid />
        </Button>
        <Button
          size="icon-sm"
          variant={viewMode === "list" ? "secondary" : "ghost"}
          onClick={() => setViewMode("list")}
          aria-label={t("listView")}
          aria-pressed={viewMode === "list"}
        >
          <List />
        </Button>
      </div>
    </div>
  );

  const collectionCountLabel =
    items.length === 0
      ? undefined
      : itemsPartial
        ? t("booksCountPartial", { count: displayedItems.length })
        : t("booksCount", { count: displayedItems.length });

  const addPanel = (
    <section
      ref={addSectionRef}
      id="library-add-panel"
      aria-label={t("addRegion")}
      className="scroll-mt-6 space-y-5 rounded-2xl bg-muted/30 px-4 py-6 sm:px-7 sm:py-8"
    >
      <SectionHeader
        title={t("addBooksTitle")}
        description={t("addBooksDescription")}
        className="mb-0"
      />
      <Tabs
        value={addTab}
        onValueChange={(value) => setAddTab((value as AddTab) ?? "import")}
      >
        <TabsList variant="line" className="mb-5 w-full max-w-md sm:w-auto">
          <TabsTrigger value="import">{t("importTab")}</TabsTrigger>
          <TabsTrigger value="search">{t("searchSourcesTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-3">
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("uploadHelp")}
          </p>
          <UploadDropzone
            onUploaded={(item) => {
              setItems((prev) => [item, ...prev]);
            }}
          />
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("searchHelp")}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="relative min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="library-source-search">{t("searchSourcesLabel")}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="library-source-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void runSearch()}
                  placeholder={t("searchPlaceholder")}
                  className="h-10 border-border/50 bg-background/70 pl-9"
                  disabled={searching}
                />
              </div>
            </div>
            <Button
              onClick={() => void runSearch()}
              disabled={searching || !query.trim()}
              className="sm:shrink-0"
            >
              {searching ? <Loader2 className="animate-spin" /> : <Search />}
              {t("search")}
            </Button>
          </div>

          {searching && (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: prefersReducedMotion ? 0.01 : 0.18,
                ease: [0.2, 0, 0, 1],
              }}
              aria-busy="true"
              aria-live="polite"
            >
              <StatePanel className="border-transparent bg-background/40 py-10">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-chart-1" />
                  {t("searching")}
                </div>
                <div className="mt-4 grid w-full gap-3 sm:grid-cols-2">
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              </StatePanel>
            </motion.div>
          )}

          {!searching && results !== null && (
            <Reveal>
              {results.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title={t("noResultsHint")}
                  description={t("searchHelpMatch")}
                />
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground" role="status">
                    {t("resultsFound", { count: results.length })}
                  </p>

                  <div className="grid gap-3 lg:hidden">
                    {results.map((result) => {
                      const resultKey = `${result.source}:${result.result_id}`;
                      const isPending = resultKey in pendingJobs;
                      return (
                        <article
                          key={resultKey}
                          className="flex gap-3 rounded-xl bg-background/50 p-3 ring-1 ring-border/40"
                        >
                          <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border/40">
                            <SearchCoverImage
                              coverUrl={result.cover_url}
                              className="absolute inset-0 size-full"
                              iconClassName="size-5"
                            />
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div>
                              <h3 className="line-clamp-2 text-sm font-medium">{result.title}</h3>
                              <p className="line-clamp-1 text-sm text-muted-foreground">
                                {result.author}
                              </p>
                            </div>
                            <p className="text-xs tracking-wide text-muted-foreground uppercase">
                              {sourceLabel(result.source)}
                              <span className="mx-1.5 text-border">·</span>
                              {result.format}
                              {result.owned ? (
                                <>
                                  <span className="mx-1.5 text-border">·</span>
                                  {t("owned")}
                                </>
                              ) : null}
                              {isPending ? (
                                <>
                                  <span className="mx-1.5 text-border">·</span>
                                  {t("fetching")}
                                </>
                              ) : null}
                            </p>
                            <SearchResultActions
                              result={result}
                              resultKey={resultKey}
                              isPending={isPending}
                              addingId={addingId}
                              onAdd={addResult}
                              t={t}
                            />
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="hidden overflow-hidden rounded-xl bg-background/40 ring-1 ring-border/40 lg:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-14" />
                          <TableHead>{t("title")}</TableHead>
                          <TableHead>{t("author")}</TableHead>
                          <TableHead>{t("source")}</TableHead>
                          <TableHead>{t("format")}</TableHead>
                          <TableHead className="text-right">{t("action")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((result) => {
                          const resultKey = `${result.source}:${result.result_id}`;
                          const isPending = resultKey in pendingJobs;
                          return (
                            <TableRow key={resultKey}>
                              <TableCell>
                                <div className="relative flex size-11 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-border/40">
                                  <SearchCoverImage
                                    coverUrl={result.cover_url}
                                    iconClassName="size-4"
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="line-clamp-2">{result.title}</span>
                                  {result.owned && (
                                    <Badge variant="secondary">{t("owned")}</Badge>
                                  )}
                                  {isPending && (
                                    <Badge variant="outline" className="gap-1">
                                      <Loader2 className="size-3 animate-spin" />
                                      {t("fetching")}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {result.author}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {sourceLabel(result.source)}
                              </TableCell>
                              <TableCell className="text-muted-foreground uppercase">
                                {result.format}
                              </TableCell>
                              <TableCell className="text-right">
                                <SearchResultActions
                                  result={result}
                                  resultKey={resultKey}
                                  isPending={isPending}
                                  addingId={addingId}
                                  onAdd={addResult}
                                  t={t}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </Reveal>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );

  const retryButton = (
    <Button size="sm" variant="outline" onClick={handleRetry} disabled={retrying} className="w-fit">
      {retrying ? <Loader2 className="animate-spin" /> : null}
      {t("retryLoad")}
    </Button>
  );

  return (
    <div className="space-y-12">
      {Object.entries(pendingJobs).map(([resultKey, jobId]) => (
        <PendingFetchTracker
          key={jobId}
          resultKey={resultKey}
          jobId={jobId}
          onDone={handleFetchDone}
          onFailed={handleFetchFailed}
          onTimeout={handleFetchTimeout}
        />
      ))}

      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          <div className="mb-3 h-px w-20 bg-gradient-to-r from-chart-1 via-chart-2 to-transparent" />
          <h1 className="font-heading text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">{description}</p>
          {collectionCountLabel ? (
            <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
              {collectionCountLabel}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground/80">{t("passageHint")}</p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <Button
            onClick={() => (addOpen ? setAddOpen(false) : openAdd(addTab))}
            variant={addOpen ? "outline" : "default"}
            aria-expanded={addOpen}
            aria-controls="library-add-panel"
            className="w-full sm:w-auto"
          >
            {!addOpen ? <Plus /> : null}
            {addOpen ? t("hideAddBooks") : t("addBooks")}
          </Button>
          {!addOpen ? (
            <p className="max-w-56 text-xs leading-relaxed text-muted-foreground sm:text-right">
              {t("addBooksHint")}
            </p>
          ) : null}
        </div>
      </header>

      {itemsUnavailable && items.length === 0 ? (
        <div role="alert">
          <EmptyState
            title={t("emptyUnavailableTitle")}
            description={t("emptyUnavailable")}
            action={retryButton}
          />
        </div>
      ) : (
        <section aria-label={t("collectionRegion")} className="space-y-6">
          {itemsPartial && items.length > 0 ? (
            <div
              role="status"
              className="flex flex-col gap-3 rounded-xl bg-accent/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-heading text-sm font-medium tracking-tight">
                  {t("partialWarningTitle")}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("partialWarning")}
                </p>
              </div>
              {retryButton}
            </div>
          ) : null}

          {items.length === 0 ? (
            <EmptyState
              visual={<EmptyLibraryIllustration />}
              title={t("emptyTitle")}
              description={t("emptyDescription")}
              action={
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <Button onClick={() => openAdd("import")}>{t("importTab")}</Button>
                  <Button variant="outline" onClick={() => openAdd("search")}>
                    {t("searchSourcesTab")}
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-heading text-xl font-medium tracking-tight text-balance">
                      {t("myLibrary")}
                    </h2>
                  </div>
                </div>

                <div className="hidden rounded-xl bg-muted/25 px-4 py-3 lg:block">
                  {filterControls}
                </div>

                <details className="group rounded-xl bg-muted/25 px-4 py-3 lg:hidden">
                  <summary className="cursor-pointer list-none text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-3">
                      {t("filtersSummary")}
                      <span className="text-xs font-normal text-muted-foreground group-open:hidden">
                        {t("filtersLabel")}
                      </span>
                    </span>
                  </summary>
                  <div className="mt-4 border-t border-border/40 pt-4">{filterControls}</div>
                </details>
              </div>

              {displayedItems.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title={t("noMatch")}
                  description={t("noMatchDescription")}
                  action={
                    <Button variant="outline" size="sm" onClick={resetFilters}>
                      {t("resetFilters")}
                    </Button>
                  }
                />
              ) : viewMode === "grid" ? (
                <RevealGroup
                  className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4"
                  stagger={prefersReducedMotion ? 0 : 0.04}
                >
                  {displayedItems.map((item) => (
                    <RevealItem key={item.id}>
                      <article className="group flex h-full flex-col gap-3.5">
                        <div
                          className={cn(
                            "relative aspect-3/4 overflow-hidden rounded-lg bg-muted",
                            "shadow-[0_18px_36px_-18px_rgba(0,0,0,0.65)] ring-1 ring-border/30",
                            "motion-safe:transition-transform motion-safe:duration-200",
                            "motion-safe:group-hover:-translate-y-1"
                          )}
                        >
                          <LibraryCoverImage
                            itemId={item.id}
                            hasCover={Boolean(item.cover_url)}
                            alt={item.title}
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <h3 className="line-clamp-2 text-[15px] leading-snug font-medium">
                            {item.title}
                          </h3>
                          <p className="line-clamp-1 text-sm text-muted-foreground">
                            {item.author || tCommon("dash")}
                          </p>
                          <p className="pt-0.5 text-xs tracking-wide text-muted-foreground/90 uppercase">
                            {item.original_format}
                            <span className="mx-1.5 text-border">·</span>
                            {sourceBadgeLabel(item)}
                          </p>
                        </div>
                        <BookActions
                          item={item}
                          canDeliver={canDeliver}
                          onDetails={setDetailItem}
                          onDeliver={setDeliverItem}
                          t={t}
                          fullWidth
                        />
                      </article>
                    </RevealItem>
                  ))}
                </RevealGroup>
              ) : (
                <>
                  <div className="grid gap-4 lg:hidden">
                    {displayedItems.map((item) => (
                      <article key={item.id} className="flex gap-4">
                        <div
                          className={cn(
                            "relative aspect-3/4 w-20 shrink-0 overflow-hidden rounded-md bg-muted",
                            "shadow-[0_14px_28px_-16px_rgba(0,0,0,0.55)] ring-1 ring-border/30"
                          )}
                        >
                          <LibraryCoverImage
                            itemId={item.id}
                            hasCover={Boolean(item.cover_url)}
                            alt={item.title}
                            iconClassName="size-6"
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-2.5">
                          <div className="space-y-1">
                            <h3 className="line-clamp-2 text-[15px] leading-snug font-medium">
                              {item.title}
                            </h3>
                            <p className="line-clamp-1 text-sm text-muted-foreground">
                              {item.author || tCommon("dash")}
                            </p>
                            <p className="text-xs tracking-wide text-muted-foreground/90 uppercase">
                              {item.original_format}
                              <span className="mx-1.5 text-border">·</span>
                              {sourceBadgeLabel(item)}
                            </p>
                          </div>
                          <BookActions
                            item={item}
                            canDeliver={canDeliver}
                            onDetails={setDetailItem}
                            onDeliver={setDeliverItem}
                            t={t}
                          />
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="hidden overflow-hidden rounded-xl bg-muted/20 ring-1 ring-border/40 lg:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-16" />
                          <TableHead>{t("title")}</TableHead>
                          <TableHead>{t("author")}</TableHead>
                          <TableHead>{t("format")}</TableHead>
                          <TableHead>{t("language")}</TableHead>
                          <TableHead>{t("added")}</TableHead>
                          <TableHead className="text-right">{t("action")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedItems.map((item) => (
                          <TableRow key={item.id} className="hover:bg-muted/30">
                            <TableCell>
                              <div className="relative size-12 overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-border/40">
                                <LibraryCoverImage
                                  itemId={item.id}
                                  hasCover={Boolean(item.cover_url)}
                                  alt={item.title}
                                  iconClassName="size-4"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              <span className="line-clamp-2">{item.title}</span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.author || tCommon("dash")}
                            </TableCell>
                            <TableCell className="text-muted-foreground uppercase">
                              {item.original_format}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.language ?? tCommon("dash")}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatAppDate(item.added_at, locale)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end">
                                <BookActions
                                  item={item}
                                  canDeliver={canDeliver}
                                  onDetails={setDetailItem}
                                  onDeliver={setDeliverItem}
                                  t={t}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      )}

      {addOpen ? addPanel : null}

      <BookDetailDialog
        item={detailItem}
        devices={devices}
        onOpenChange={(open) => !open && setDetailItem(null)}
        onUpdated={(updated) => {
          setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
          setDetailItem(updated);
        }}
        onDeleted={(id) => {
          setItems((prev) => prev.filter((it) => it.id !== id));
        }}
      />

      <DeliverDialog
        item={deliverItem}
        devices={devices}
        onOpenChange={(open) => !open && setDeliverItem(null)}
        onDelivered={() => {
          setDeliverItem(null);
        }}
      />
    </div>
  );
}
