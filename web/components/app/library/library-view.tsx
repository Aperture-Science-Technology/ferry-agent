"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Loader2, Search, SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
// brand name for mobile top label (Pen mF0028)
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/app/empty-state";
import { StatePanel } from "@/components/app/state-panel";
import { BookDetailDialog } from "@/components/app/library/book-detail-dialog";
import { DeliverDialog } from "@/components/app/library/deliver-dialog";
import {
  applyLibraryItemsRefreshResult,
  filterAndSortLibraryItems,
  LIBRARY_COLLECTION_PAGE_SIZE,
  libraryCollectionPageState,
  pageAfterLibraryCriteriaChange,
  paginateLibraryItems,
  recentLibraryItems,
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

type BrowseMode = "mine" | "sources";
type AddTab = "search" | "import";

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
  const tBrand = useTranslations("brand");
  const { call } = useApiClient();
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [collectionQuery, setCollectionQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [pendingJobs, setPendingJobs] = useState<Record<string, string>>({});
  const [items, setItems] = useState(initialItems);
  const [detailItem, setDetailItem] = useState<LibraryItem | null>(null);
  const [deliverItem, setDeliverItem] = useState<LibraryItem | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [browseMode, setBrowseMode] = useState<BrowseMode>(
    initialItems.length === 0 && !itemsUnavailable ? "sources" : "mine"
  );
  const [addTab, setAddTab] = useState<AddTab>("search");

  const canDeliver = devices.length > 0;
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const headerSendEnabled = Boolean(selectedItem && canDeliver);

  useEffect(() => {
    if (browseMode !== "sources" || addTab !== "search") return;
    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [browseMode, addTab]);

  const filterCriteriaKey = `${collectionQuery}\0all\0all\0all\0added`;
  const [pageState, setPageState] = useState({
    criteriaKey: filterCriteriaKey,
    page: 1,
  });

  const nextPageState = libraryCollectionPageState(pageState, filterCriteriaKey);
  if (nextPageState !== pageState) {
    setPageState(nextPageState);
  }

  const collectionPage =
    pageState.criteriaKey === filterCriteriaKey
      ? pageState.page
      : pageAfterLibraryCriteriaChange();

  const displayedItems = useMemo(
    () =>
      filterAndSortLibraryItems(items, {
        textQuery: collectionQuery,
        languageFilter: "all",
        formatFilter: "all",
        sourceFilter: "all",
        sortBy: "added",
      }),
    [items, collectionQuery]
  );

  const recentItems = useMemo(
    () => recentLibraryItems(displayedItems),
    [displayedItems]
  );

  const pageSlice = useMemo(
    () => paginateLibraryItems(displayedItems, collectionPage, LIBRARY_COLLECTION_PAGE_SIZE),
    [displayedItems, collectionPage]
  );

  if (
    pageState.criteriaKey === filterCriteriaKey &&
    pageSlice.page !== pageState.page
  ) {
    setPageState({ criteriaKey: filterCriteriaKey, page: pageSlice.page });
  }

  function setCollectionPage(nextPage: number) {
    setPageState({
      criteriaKey: filterCriteriaKey,
      page: nextPage,
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
      setItems((prev) => applyLibraryItemsRefreshResult(prev, itemsAcc).items);
    } catch {
      setItems((prev) => applyLibraryItemsRefreshResult(prev, null).items);
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
    setBrowseMode("sources");
    setAddTab("search");
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

  function sourceLabel(source: string) {
    if (source === "gutenberg") return t("sourceGutenberg");
    if (source === "standard_ebooks") return t("sourceStandardEbooks");
    if (source === "upload") return t("sourceManual");
    if (source.startsWith("gateway:")) return t("sourceLinked");
    return source;
  }

  function handleRetry() {
    setRetrying(true);
    router.refresh();
  }

  function selectBook(item: LibraryItem) {
    setSelectedId((prev) => (prev === item.id ? null : item.id));
  }

  function openDeliver(item: LibraryItem) {
    setSelectedId(item.id);
    setDeliverItem(item);
  }

  function handleHeaderSend() {
    if (!selectedItem || !canDeliver) return;
    setDeliverItem(selectedItem);
  }

  const headerSearchValue = browseMode === "mine" ? collectionQuery : query;
  const headerSearchPlaceholder =
    browseMode === "mine"
      ? t("collectionSearchPlaceholder")
      : t("searchSourcesPlaceholder");

  function onHeaderSearchChange(value: string) {
    if (browseMode === "mine") {
      setCollectionQuery(value);
    } else {
      setQuery(value);
    }
  }

  function onHeaderSearchSubmit() {
    if (browseMode === "mine") return;
    void runSearch();
  }

  const paginationControls =
    displayedItems.length > LIBRARY_COLLECTION_PAGE_SIZE ? (
      <nav
        className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between"
        aria-label={t("paginationRegion")}
      >
        <p className="min-w-0 text-sm text-muted-foreground" aria-live="polite">
          {t("paginationRange", {
            from: pageSlice.rangeStart,
            to: pageSlice.rangeEnd,
            total: pageSlice.total,
          })}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCollectionPage(Math.max(1, pageSlice.page - 1))}
            disabled={pageSlice.page <= 1}
            aria-label={t("paginationPrevious")}
          >
            <ChevronLeft />
            <span className="hidden sm:inline">{t("paginationPrevious")}</span>
          </Button>
          <span className="min-w-24 text-center text-xs text-muted-foreground tabular-nums">
            {t("paginationPage", { page: pageSlice.page, pageCount: pageSlice.pageCount })}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCollectionPage(Math.min(pageSlice.pageCount, pageSlice.page + 1))}
            disabled={pageSlice.page >= pageSlice.pageCount}
            aria-label={t("paginationNext")}
          >
            <span className="hidden sm:inline">{t("paginationNext")}</span>
            <ChevronRight />
          </Button>
        </div>
      </nav>
    ) : null;

  const retryButton = (
    <Button size="sm" variant="outline" onClick={handleRetry} disabled={retrying} className="w-fit">
      {retrying ? <Loader2 className="animate-spin" /> : null}
      {t("retryLoad")}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6" data-testid="library-pen-layout">
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

      {/* Pen Header/Page ePLzB — 72 px, Fraunces 18/500 + subtitle 12/500 */}
      <header className="flex min-h-[72px] flex-col justify-center gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-heading text-sm font-medium text-muted-foreground md:hidden">
            {tBrand("name")}
          </p>
          <h1 className="font-heading text-[22px] font-medium text-foreground md:text-lg">
            {title}
          </h1>
          <p className="text-xs font-medium text-muted-foreground">{description}</p>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end md:w-auto">
          <div className="relative flex w-full max-w-none items-center gap-2 rounded-md border border-border bg-muted px-3 py-2.5 md:w-[280px]">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Label htmlFor="library-header-search" className="sr-only">
              {browseMode === "mine"
                ? t("collectionSearchLabel")
                : t("searchSourcesLabel")}
            </Label>
            <Input
              ref={searchInputRef}
              id="library-header-search"
              value={headerSearchValue}
              onChange={(event) => onHeaderSearchChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onHeaderSearchSubmit();
              }}
              placeholder={headerSearchPlaceholder}
              className="h-auto border-0 bg-transparent p-0 text-sm font-medium shadow-none focus-visible:ring-0"
              autoComplete="off"
              spellCheck={false}
              disabled={browseMode === "sources" && searching}
            />
          </div>
          <Button
            type="button"
            className="rounded-md px-3.5 py-2.5 text-sm font-medium disabled:pointer-events-none disabled:bg-card disabled:text-disabled disabled:opacity-50"
            disabled={!headerSendEnabled}
            aria-disabled={!headerSendEnabled}
            onClick={handleHeaderSend}
          >
            {t("deliver")}
          </Button>
        </div>
      </header>

      {/* Pen Library tools — mode chips */}
      <div
        className="flex flex-wrap items-center gap-4"
        role="tablist"
        aria-label={t("browseModeLabel")}
      >
        <button
          type="button"
          role="tab"
          aria-selected={browseMode === "mine"}
          className={cn(
            "rounded-sm border px-3 py-2 text-sm font-medium",
            browseMode === "mine"
              ? "border-border bg-card text-foreground"
              : "border-border bg-transparent text-muted-foreground"
          )}
          onClick={() => setBrowseMode("mine")}
        >
          {t("modeMine")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={browseMode === "sources"}
          className={cn(
            "rounded-sm border px-3 py-2 text-sm font-medium",
            browseMode === "sources"
              ? "border-border bg-card text-foreground"
              : "border-border bg-transparent text-muted-foreground"
          )}
          onClick={() => {
            setBrowseMode("sources");
            setAddTab("search");
          }}
        >
          {t("modeSources")}
        </button>
      </div>

      {itemsUnavailable && items.length === 0 ? (
        <div role="alert">
          <EmptyState
            title={t("emptyUnavailableTitle")}
            description={t("emptyUnavailable")}
            action={retryButton}
          />
        </div>
      ) : browseMode === "sources" ? (
        <section aria-label={t("addRegion")} className="space-y-5">
          {itemsPartial && items.length > 0 ? (
            <div
              role="status"
              className="flex flex-col gap-3 rounded-md border border-border bg-accent/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">{t("partialWarningTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("partialWarning")}</p>
              </div>
              {retryButton}
            </div>
          ) : null}

          <Tabs
            value={addTab}
            onValueChange={(value) => setAddTab((value as AddTab) ?? "search")}
          >
            <TabsList variant="line" className="mb-4 w-full max-w-md sm:w-auto">
              <TabsTrigger value="search">{t("searchSourcesTab")}</TabsTrigger>
              <TabsTrigger value="import">{t("importTab")}</TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="space-y-5">
              <p className="max-w-2xl text-sm text-muted-foreground">{t("searchHelp")}</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  onClick={() => void runSearch()}
                  disabled={searching || !query.trim()}
                  className="rounded-md"
                >
                  {searching ? <Loader2 className="animate-spin" /> : <Search />}
                  {t("search")}
                </Button>
              </div>

              {searching ? (
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
                  <StatePanel className="border-border/60 bg-card/40 py-12">
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin text-primary" />
                      {t("searching")}
                    </div>
                    <div className="mt-4 grid w-full gap-3 sm:grid-cols-2">
                      <Skeleton className="h-24 w-full rounded-md" />
                      <Skeleton className="h-24 w-full rounded-md" />
                    </div>
                  </StatePanel>
                </motion.div>
              ) : null}

              {!searching && results !== null ? (
                <Reveal>
                  {results.length === 0 ? (
                    <EmptyState
                      icon={SearchX}
                      title={t("noResultsHint")}
                      description={t("searchHelpMatch")}
                    />
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm font-medium" role="status">
                        {t("resultsFound", { count: results.length })}
                      </p>
                      <div className="grid gap-0 divide-y divide-border lg:hidden">
                        {results.map((result) => {
                          const resultKey = `${result.source}:${result.result_id}`;
                          const isPending = resultKey in pendingJobs;
                          return (
                            <article key={resultKey} className="flex gap-3 py-3">
                              <div className="relative size-16 shrink-0 overflow-hidden rounded-[9px] bg-muted">
                                <SearchCoverImage
                                  coverUrl={result.cover_url}
                                  className="absolute inset-0 size-full"
                                />
                              </div>
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="min-w-0">
                                  <h3 className="line-clamp-2 text-sm font-medium">
                                    {result.title}
                                  </h3>
                                  <p className="line-clamp-1 text-sm text-muted-foreground">
                                    {result.author}
                                  </p>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {sourceLabel(result.source)}
                                  <span className="mx-1.5 text-border">·</span>
                                  {result.format}
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
                      <div className="hidden overflow-x-auto lg:block">
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
                                    <div className="relative size-11 overflow-hidden rounded-[9px] bg-muted">
                                      <SearchCoverImage coverUrl={result.cover_url} />
                                    </div>
                                  </TableCell>
                                  <TableCell className="max-w-56 font-medium">
                                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                      <span className="line-clamp-2">{result.title}</span>
                                      {result.owned ? (
                                        <Badge variant="secondary">{t("owned")}</Badge>
                                      ) : null}
                                      {isPending ? (
                                        <Badge variant="outline" className="gap-1">
                                          <Loader2 className="size-3 animate-spin" />
                                          {t("fetching")}
                                        </Badge>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {result.author}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {sourceLabel(result.source)}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
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
              ) : null}
            </TabsContent>

            <TabsContent value="import" className="space-y-3">
              <p className="max-w-2xl text-sm text-muted-foreground">{t("uploadHelp")}</p>
              <UploadDropzone
                onUploaded={(item) => {
                  setItems((prev) => [item, ...prev]);
                  setBrowseMode("mine");
                }}
              />
            </TabsContent>
          </Tabs>
        </section>
      ) : items.length === 0 ? (
        <EmptyState
          visual={<EmptyLibraryIllustration />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                onClick={() => {
                  setBrowseMode("sources");
                  setAddTab("search");
                }}
              >
                {t("searchSourcesTab")}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setBrowseMode("sources");
                  setAddTab("import");
                }}
              >
                {t("importTab")}
              </Button>
            </div>
          }
        />
      ) : (
        <section aria-label={t("collectionRegion")} className="flex flex-col gap-6">
          {itemsPartial ? (
            <div
              role="status"
              className="flex flex-col gap-3 rounded-md border border-border bg-accent/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">{t("partialWarningTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("partialWarning")}</p>
              </div>
              {retryButton}
            </div>
          ) : null}

          {displayedItems.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={t("noMatch")}
              description={t("noMatchDescription")}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCollectionQuery("")}
                >
                  {t("resetFilters")}
                </Button>
              }
            />
          ) : (
            <>
              {/* Pen Book grid dZwIa — desktop; mobile filled uses rows */}
              <div
                data-testid="library-book-grid"
                className="hidden gap-5 md:flex md:flex-wrap"
              >
                <RevealGroup
                  className="flex flex-wrap gap-5"
                  stagger={prefersReducedMotion ? 0 : 0.04}
                >
                  {pageSlice.items.map((item) => {
                    const selected = selectedId === item.id;
                    return (
                      <RevealItem key={item.id}>
                        <article
                          className={cn(
                            "flex w-[140px] flex-col gap-2.5",
                            selected && "outline-none"
                          )}
                        >
                          <button
                            type="button"
                            className={cn(
                              "relative h-[186px] w-[140px] overflow-hidden rounded-[9px] bg-muted text-left",
                              "focus-visible:ring-2 focus-visible:ring-ring",
                              selected && "ring-2 ring-ring"
                            )}
                            aria-pressed={selected}
                            aria-label={item.title}
                            onClick={() => selectBook(item)}
                            onDoubleClick={() => setDetailItem(item)}
                          >
                            <LibraryCoverImage
                              itemId={item.id}
                              hasCover={Boolean(item.cover_url)}
                              alt={item.title}
                            />
                          </button>
                          <button
                            type="button"
                            className="min-w-0 text-left"
                            onClick={() => selectBook(item)}
                          >
                            <h3 className="line-clamp-2 w-full text-sm font-medium text-foreground">
                              {item.title}
                            </h3>
                            <p className="line-clamp-1 text-xs font-medium text-muted-foreground">
                              {item.author || tCommon("dash")}
                            </p>
                          </button>
                        </article>
                      </RevealItem>
                    );
                  })}
                </RevealGroup>
              </div>

              {/* Pen Book list / Récents — simultaneous with grid on desktop */}
              <div data-testid="library-recent-section" className="flex w-full flex-col">
                <h2 className="mb-0 text-sm font-medium text-muted-foreground">
                  {t("recentSection")}
                </h2>
                <ul className="flex flex-col">
                  {(recentItems.length > 0 ? recentItems : pageSlice.items.slice(0, 3)).map(
                    (item) => {
                      const selected = selectedId === item.id;
                      return (
                        <li key={item.id}>
                          <div
                            className={cn(
                              "flex items-center gap-4 border-b border-border py-3",
                              selected && "bg-muted/40"
                            )}
                          >
                            <button
                              type="button"
                              className="relative h-14 w-10 shrink-0 overflow-hidden rounded-[9px] bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                              aria-pressed={selected}
                              aria-label={item.title}
                              onClick={() => selectBook(item)}
                              onDoubleClick={() => setDetailItem(item)}
                            >
                              <LibraryCoverImage
                                itemId={item.id}
                                hasCover={Boolean(item.cover_url)}
                                alt={item.title}
                              />
                            </button>
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left"
                              onClick={() => selectBook(item)}
                            >
                              <p className="line-clamp-1 text-base font-medium text-foreground">
                                {item.title}
                              </p>
                              <p className="line-clamp-1 text-xs font-medium text-muted-foreground">
                                {item.author || tCommon("dash")}
                                <span className="mx-1.5 text-border">·</span>
                                {item.original_format.toUpperCase()}
                              </p>
                            </button>
                            <div className="flex shrink-0 items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-sm px-3 py-2 text-sm font-medium"
                                aria-label={t("detailsOf", { title: item.title })}
                                onClick={() => setDetailItem(item)}
                              >
                                {t("details")}
                              </Button>
                              {canDeliver ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="rounded-sm border-border px-3 py-2 text-sm font-medium"
                                  aria-label={t("deliverOf", { title: item.title })}
                                  onClick={() => openDeliver(item)}
                                >
                                  {t("deliver")}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    }
                  )}
                </ul>
              </div>

              {paginationControls}
            </>
          )}
        </section>
      )}

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
          if (selectedId === id) setSelectedId(null);
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
