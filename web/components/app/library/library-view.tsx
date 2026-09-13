"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { motion, useReducedMotion } from "motion/react";
import {
  BookOpen,
  LayoutGrid,
  List,
  Loader2,
  Search,
  SearchX,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
} from "@/components/ui/card";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/app/empty-state";
import { SectionHeader } from "@/components/app/section-header";
import { StatePanel } from "@/components/app/state-panel";
import { BookDetailDialog } from "@/components/app/library/book-detail-dialog";
import {
  LibraryCoverImage,
  SearchCoverImage,
} from "@/components/app/library/cover-image";
import { UploadDropzone } from "@/components/app/library/upload-dropzone";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { ApiError, useApiClient } from "@/lib/api-client";
import { useGatewayJob } from "@/lib/use-gateway-job";
import { cn } from "@/lib/utils";
import type { Device, LibraryItem, PaginatedLibraryItems, SearchResult } from "@/lib/types";

type ViewMode = "grid" | "list";
type SortBy = "title" | "author" | "added";
type SourceFilter = "all" | "linked" | "manual";

/** Upload = pas de `source_ref` ; accès personnel = ref `gateway:…`. */
function isManualLibraryItem(item: LibraryItem): boolean {
  return !item.source_ref;
}

function isLinkedLibraryItem(item: LibraryItem): boolean {
  return Boolean(item.source_ref?.startsWith("gateway:"));
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

export function LibraryView({
  initialItems,
  itemsUnavailable,
  devices,
}: {
  initialItems: LibraryItem[];
  itemsUnavailable: boolean;
  devices: Device[];
}) {
  const t = useTranslations("library");
  const { call } = useApiClient();
  const prefersReducedMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [pendingJobs, setPendingJobs] = useState<Record<string, string>>({});
  const [items, setItems] = useState(initialItems);
  const [detailItem, setDetailItem] = useState<LibraryItem | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortBy>("added");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const languages = useMemo(
    () => Array.from(new Set(items.map((item) => item.language).filter((v): v is string => !!v))),
    [items]
  );
  const formats = useMemo(
    () => Array.from(new Set(items.map((item) => item.original_format))),
    [items]
  );

  const displayedItems = useMemo(() => {
    let list = items;
    if (languageFilter !== "all") {
      list = list.filter((item) => item.language === languageFilter);
    }
    if (formatFilter !== "all") {
      list = list.filter((item) => item.original_format === formatFilter);
    }
    if (sourceFilter === "linked") {
      list = list.filter(isLinkedLibraryItem);
    } else if (sourceFilter === "manual") {
      list = list.filter(isManualLibraryItem);
    }
    return [...list].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "author") return a.author.localeCompare(b.author);
      return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
    });
  }, [items, languageFilter, formatFilter, sourceFilter, sortBy]);

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

  async function handleFetchDone(resultKey: string, _libraryItemId: string | null) {
    clearPending(resultKey);
    markOwned(resultKey);
    try {
      const refreshed = await call<PaginatedLibraryItems>("/api/v1/books?page=1&limit=200");
      const itemsAcc = [...refreshed.items];
      const totalPages = Math.max(1, Math.ceil(refreshed.total / refreshed.limit));
      for (let page = 2; page <= totalPages; page += 1) {
        const next = await call<PaginatedLibraryItems>(`/api/v1/books?page=${page}&limit=200`);
        itemsAcc.push(...next.items);
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

  const filterControls =
    items.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2" aria-label={t("filtersLabel")}>
        <Select value={sortBy} onValueChange={(value) => setSortBy((value as SortBy) ?? "added")}>
          <SelectTrigger size="sm" className="min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="added">{t("sortAdded")}</SelectItem>
            <SelectItem value="title">{t("sortTitle")}</SelectItem>
            <SelectItem value="author">{t("sortAuthor")}</SelectItem>
          </SelectContent>
        </Select>

        {languages.length > 0 && (
          <Select value={languageFilter} onValueChange={(value) => setLanguageFilter(value ?? "all")}>
            <SelectTrigger size="sm" className="min-w-32">
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
        )}

        {formats.length > 1 && (
          <Select value={formatFilter} onValueChange={(value) => setFormatFilter(value ?? "all")}>
            <SelectTrigger size="sm" className="min-w-32">
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
        )}

        <Select
          value={sourceFilter}
          onValueChange={(value) => setSourceFilter((value as SourceFilter) ?? "all")}
        >
          <SelectTrigger size="sm" className="min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterSourceAll")}</SelectItem>
            <SelectItem value="linked">{t("sourceLinked")}</SelectItem>
            <SelectItem value="manual">{t("sourceManual")}</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-1 rounded-lg border border-border/60 p-0.5">
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
    ) : null;

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

      <Reveal>
        <SectionHeader
          title={t("uploadTitle")}
          description={`${t("uploadHelp")} ${t("passageHint")}`}
        />
        <UploadDropzone onUploaded={(item) => setItems((prev) => [item, ...prev])} />
      </Reveal>

      <Separator className="bg-gradient-to-r from-transparent via-border to-transparent" />

      <Reveal delay={0.05}>
        <SectionHeader title={t("addBooksTitle")} description={t("searchHelp")} />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && runSearch()}
              placeholder={t("searchPlaceholder")}
              className="h-10 pl-9"
            />
          </div>
          <Button onClick={runSearch} disabled={searching} className="sm:shrink-0">
            {searching ? <Loader2 className="animate-spin" /> : <Search />}
            {t("search")}
          </Button>
        </div>

        {searching && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.3, ease: "easeOut" }}
            className="mt-5"
          >
            <StatePanel className="py-10">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-chart-1" />
                {t("searching")}
              </div>
              <div className="mt-4 grid w-full gap-3 sm:grid-cols-2">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg sm:col-span-2" />
              </div>
            </StatePanel>
          </motion.div>
        )}

        {!searching && results !== null && (
          <Reveal className="mt-5">
            {results.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title={t("noResultsHint")}
                description={t("searchHelpMatch")}
              />
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t("resultsFound", { count: results.length })}
                </p>

                {/* Mobile / narrow: cards */}
                <div className="grid gap-3 md:hidden">
                  {results.map((result) => {
                    const resultKey = `${result.source}:${result.result_id}`;
                    const isPending = resultKey in pendingJobs;
                    return (
                      <Card key={resultKey} size="sm" className="bg-card/60">
                        <CardContent className="flex gap-3">
                          <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border/50">
                            <SearchCoverImage
                              coverUrl={result.cover_url}
                              className="absolute inset-0 size-full"
                              iconClassName="size-5"
                            />
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div>
                              <CardTitle className="line-clamp-2 text-sm">{result.title}</CardTitle>
                              <CardDescription className="line-clamp-1">
                                {result.author}
                              </CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="secondary">{sourceLabel(result.source)}</Badge>
                              <Badge variant="outline" className="uppercase">
                                {result.format}
                              </Badge>
                              {result.owned && <Badge variant="secondary">{t("owned")}</Badge>}
                              {isPending && (
                                <Badge variant="outline" className="gap-1">
                                  <Loader2 className="size-3 animate-spin" />
                                  {t("fetching")}
                                </Badge>
                              )}
                            </div>
                            <SearchResultActions
                              result={result}
                              resultKey={resultKey}
                              isPending={isPending}
                              addingId={addingId}
                              onAdd={addResult}
                              t={t}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Desktop: table */}
                <div className="hidden overflow-hidden rounded-xl border border-border/60 md:block">
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
                            <TableCell>
                              <Badge variant="secondary">{sourceLabel(result.source)}</Badge>
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
      </Reveal>

      <Separator className="bg-gradient-to-r from-transparent via-border to-transparent" />

      <Reveal delay={0.08}>
        <SectionHeader
          title={t("myLibrary")}
          description={
            items.length > 0 ? t("booksCount", { count: displayedItems.length }) : undefined
          }
          action={filterControls}
        />

        {itemsUnavailable && items.length === 0 ? (
          <Alert>
            <BookOpen />
            <AlertTitle>{t("emptyTitle")}</AlertTitle>
            <AlertDescription>{t("emptyUnavailable")}</AlertDescription>
          </Alert>
        ) : items.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        ) : displayedItems.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={t("noMatch")}
            action={
              <Button variant="outline" size="sm" onClick={resetFilters}>
                {t("resetFilters")}
              </Button>
            }
          />
        ) : viewMode === "grid" ? (
          <RevealGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayedItems.map((item) => (
              <RevealItem key={item.id}>
                <Card
                  className={cn(
                    "h-full cursor-pointer pt-0 transition-colors hover:bg-card/90",
                    "ring-border/15 hover:ring-chart-1/25"
                  )}
                  onClick={() => setDetailItem(item)}
                >
                  <div className="relative aspect-3/4 w-full overflow-hidden bg-muted">
                    <LibraryCoverImage
                      itemId={item.id}
                      hasCover={Boolean(item.cover_url)}
                      alt={item.title}
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card/90 to-transparent"
                    />
                  </div>
                  <CardContent className="flex flex-1 flex-col gap-1">
                    <CardTitle className="line-clamp-2">{item.title}</CardTitle>
                    <CardDescription className="line-clamp-1">{item.author}</CardDescription>
                  </CardContent>
                  <CardFooter className="justify-between gap-2 border-border/50 bg-transparent">
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                      <Badge variant="secondary">{item.original_format.toUpperCase()}</Badge>
                      <Badge variant="outline" className="max-w-28 truncate">
                        {sourceBadgeLabel(item)}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDetailItem(item);
                      }}
                    >
                      {t("details")}
                    </Button>
                  </CardFooter>
                </Card>
              </RevealItem>
            ))}
          </RevealGroup>
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {displayedItems.map((item) => (
                <Card
                  key={item.id}
                  size="sm"
                  className="cursor-pointer bg-card/60"
                  onClick={() => setDetailItem(item)}
                >
                  <CardContent className="flex gap-3">
                    <div className="relative aspect-3/4 w-14 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border/40">
                      <LibraryCoverImage
                        itemId={item.id}
                        hasCover={Boolean(item.cover_url)}
                        alt={item.title}
                        iconClassName="size-5"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <CardTitle className="line-clamp-2 text-sm">{item.title}</CardTitle>
                        <CardDescription className="line-clamp-1">{item.author}</CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary">{item.original_format.toUpperCase()}</Badge>
                        <Badge variant="outline">{sourceBadgeLabel(item)}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="hidden overflow-hidden rounded-xl border border-border/60 md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-14" />
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
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => setDetailItem(item)}
                    >
                      <TableCell>
                        <div className="relative size-11 overflow-hidden rounded-md bg-muted ring-1 ring-border/40">
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
                      <TableCell className="text-muted-foreground">{item.author}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.original_format.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.language ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(item.added_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDetailItem(item);
                          }}
                        >
                          {t("details")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Reveal>

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
    </div>
  );
}
