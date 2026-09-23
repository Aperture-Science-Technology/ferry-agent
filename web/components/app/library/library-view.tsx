"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, useReducedMotion } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Library,
  Loader2,
  Search,
  SearchX,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookDetailDialog } from "@/components/app/library/book-detail-dialog";
import { DeliverDialog } from "@/components/app/library/deliver-dialog";
import {
  LibraryEmpty,
  LibraryFeedback,
} from "@/components/app/library/library-feedback";
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
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { ApiError, useApiClient } from "@/lib/api-client";
import { useGatewayJob } from "@/lib/use-gateway-job";
import { cn } from "@/lib/utils";
import type {
  Device,
  LibraryItem,
  PaginatedLibraryItems,
  SearchResult,
} from "@/lib/types";

type BrowseMode = "mine" | "sources";
type AddTab = "search" | "import";

function mapFetchError(
  error: string | null,
  t: ReturnType<typeof useTranslations<"library">>
): string {
  if (!error) return t("toastFetchFailed");
  if (
    /abandonn[ée] après \d+ tentatives/i.test(error) ||
    /abandoned after \d+ attempts/i.test(error)
  ) {
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
      <Button size="sm" variant="secondary" disabled className="rounded-sm">
        {t("inLibrary")}
      </Button>
    );
  }
  if (isPending) {
    return (
      <Button size="sm" variant="outline" disabled className="rounded-sm">
        <Loader2 className="animate-spin" />
        {t("fetching")}
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      className="rounded-sm"
      disabled={addingId === resultKey}
      onClick={() => onAdd(result)}
    >
      {addingId === resultKey ? <Loader2 className="animate-spin" /> : null}
      {t("add")}
    </Button>
  );
}

/** Pen Library/BookRow B3CiDv */
function BookRow({
  item,
  selected,
  canDeliver,
  onSelect,
  onOpenDetail,
  onDeliver,
  t,
  tCommon,
}: {
  item: LibraryItem;
  selected: boolean;
  canDeliver: boolean;
  onSelect: () => void;
  onOpenDetail: () => void;
  onDeliver: () => void;
  t: ReturnType<typeof useTranslations<"library">>;
  tCommon: ReturnType<typeof useTranslations<"common">>;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 border-b border-border py-3",
        selected && "bg-muted/40"
      )}
    >
      <button
        type="button"
        className="relative h-14 w-10 shrink-0 overflow-hidden rounded-[9px] bg-ferry-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
        aria-pressed={selected}
        aria-label={item.title}
        onClick={onSelect}
        onDoubleClick={onOpenDetail}
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
        onClick={onSelect}
        onDoubleClick={onOpenDetail}
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 rounded-sm border-border px-3 py-2 text-sm font-medium"
        disabled={!canDeliver}
        aria-disabled={!canDeliver}
        aria-label={t("deliverOf", { title: item.title })}
        onClick={onDeliver}
      >
        {t("deliver")}
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
    () =>
      paginateLibraryItems(
        displayedItems,
        collectionPage,
        LIBRARY_COLLECTION_PAGE_SIZE
      ),
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
      const refreshed = await call<PaginatedLibraryItems>(
        "/api/v1/books?page=1&limit=200"
      );
      const itemsAcc = [...refreshed.items];
      const totalPages = Math.max(
        1,
        Math.ceil(refreshed.total / refreshed.limit)
      );
      for (let page = 2; page <= totalPages; page += 1) {
        try {
          const next = await call<PaginatedLibraryItems>(
            `/api/v1/books?page=${page}&limit=200`
          );
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
    toast.error(t("toastFetchFailed"), {
      description: t("toastFetchTimeout"),
    });
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
      const added = await call<LibraryItem | { gateway_job_id: string }>(
        "/api/v1/books",
        {
          method: "POST",
          body: JSON.stringify({
            source: result.source,
            result_id: result.result_id,
            result,
          }),
        }
      );
      if ("gateway_job_id" in added) {
        setPendingJobs((prev) => ({
          ...prev,
          [resultKey]: added.gateway_job_id,
        }));
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
    if (!canDeliver) return;
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

  const retryButton = (
    <Button
      size="sm"
      variant="outline"
      onClick={handleRetry}
      disabled={retrying}
      className="w-fit rounded-sm"
    >
      {retrying ? <Loader2 className="animate-spin" /> : null}
      {t("retryLoad")}
    </Button>
  );

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
            className="rounded-sm"
            onClick={() => setCollectionPage(Math.max(1, pageSlice.page - 1))}
            disabled={pageSlice.page <= 1}
            aria-label={t("paginationPrevious")}
          >
            <ChevronLeft />
            <span className="hidden sm:inline">{t("paginationPrevious")}</span>
          </Button>
          <span className="min-w-24 text-center text-xs text-muted-foreground tabular-nums">
            {t("paginationPage", {
              page: pageSlice.page,
              pageCount: pageSlice.pageCount,
            })}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="rounded-sm"
            onClick={() =>
              setCollectionPage(Math.min(pageSlice.pageCount, pageSlice.page + 1))
            }
            disabled={pageSlice.page >= pageSlice.pageCount}
            aria-label={t("paginationNext")}
          >
            <span className="hidden sm:inline">{t("paginationNext")}</span>
            <ChevronRight />
          </Button>
        </div>
      </nav>
    ) : null;

  const searchField = (
    <div className="relative flex w-full items-center gap-2 rounded-md border border-border bg-ferry-surface-2 px-3 py-2.5 md:w-[280px]">
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

      {/* Pen Header/Page ePLzB (desktop) / Top mF0028 (mobile) */}
      <header className="flex min-h-[72px] flex-col justify-center gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 md:gap-1">
          <p className="font-heading text-sm font-medium text-muted-foreground md:hidden">
            {tBrand("name")}
          </p>
          <h1 className="font-heading text-[22px] font-medium text-foreground md:text-lg">
            {title}
          </h1>
          <p className="text-xs font-medium text-muted-foreground">{description}</p>
        </div>

        <div className="hidden w-full min-w-0 items-center justify-end gap-2 md:flex md:w-auto">
          {searchField}
          <Button
            type="button"
            data-testid="library-header-send"
            className="rounded-md px-3.5 py-2.5 text-sm font-medium disabled:pointer-events-none disabled:bg-card disabled:text-disabled disabled:opacity-50"
            disabled={!headerSendEnabled}
            aria-disabled={!headerSendEnabled}
            onClick={handleHeaderSend}
          >
            {t("deliver")}
          </Button>
        </div>
      </header>

      {/* Pen Library tools — mode chips (desktop a0ck4H); mobile search in body */}
      <div className="flex flex-col gap-3 md:gap-4">
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

        <div className="md:hidden">{searchField}</div>
      </div>

      {itemsUnavailable && items.length === 0 ? (
        <LibraryFeedback
          role="alert"
          icon={Library}
          title={t("emptyUnavailableTitle")}
          description={t("emptyUnavailable")}
          action={retryButton}
        />
      ) : browseMode === "sources" ? (
        <section aria-label={t("addRegion")} className="flex flex-col gap-5">
          {itemsPartial && items.length > 0 ? (
            <LibraryFeedback
              icon={Library}
              title={t("partialWarningTitle")}
              description={t("partialWarning")}
              action={retryButton}
            />
          ) : null}

          <Tabs
            value={addTab}
            onValueChange={(value) => setAddTab((value as AddTab) ?? "search")}
          >
            <TabsList variant="line" className="mb-2 w-full max-w-md sm:w-auto">
              <TabsTrigger value="search">{t("searchSourcesTab")}</TabsTrigger>
              <TabsTrigger value="import">{t("importTab")}</TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="flex flex-col gap-5">
              <p className="max-w-2xl text-sm text-muted-foreground">
                {t("searchHelp")}
              </p>
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
                  <LibraryFeedback
                    icon={Loader2}
                    iconClassName="animate-spin"
                    title={t("feedbackLoadingTitle")}
                    description={t("searching")}
                  >
                    <div className="mt-2 grid w-full gap-3 sm:grid-cols-2">
                      <Skeleton className="h-16 w-full rounded-md" />
                      <Skeleton className="h-16 w-full rounded-md" />
                    </div>
                  </LibraryFeedback>
                </motion.div>
              ) : null}

              {!searching && results !== null ? (
                <Reveal>
                  {results.length === 0 ? (
                    <LibraryEmpty
                      icon={SearchX}
                      title={t("noResultsHint")}
                      description={t("searchHelpMatch")}
                    />
                  ) : (
                    <div className="flex flex-col gap-4">
                      <p className="text-sm font-medium" role="status">
                        {t("resultsFound", { count: results.length })}
                      </p>
                      <ul className="flex flex-col">
                        {results.map((result) => {
                          const resultKey = `${result.source}:${result.result_id}`;
                          const isPending = resultKey in pendingJobs;
                          return (
                            <li key={resultKey}>
                              <article className="flex items-center gap-4 border-b border-border py-3">
                                <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-[9px] bg-ferry-surface-2">
                                  <SearchCoverImage
                                    coverUrl={result.cover_url}
                                    className="absolute inset-0 size-full"
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="line-clamp-1 text-base font-medium">
                                    {result.title}
                                  </h3>
                                  <p className="line-clamp-1 text-xs font-medium text-muted-foreground">
                                    {result.author}
                                    <span className="mx-1.5 text-border">·</span>
                                    {sourceLabel(result.source)}
                                    <span className="mx-1.5 text-border">·</span>
                                    {result.format}
                                  </p>
                                </div>
                                <SearchResultActions
                                  result={result}
                                  resultKey={resultKey}
                                  isPending={isPending}
                                  addingId={addingId}
                                  onAdd={addResult}
                                  t={t}
                                />
                              </article>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </Reveal>
              ) : null}
            </TabsContent>

            <TabsContent value="import" className="flex flex-col gap-3">
              <p className="max-w-2xl text-sm text-muted-foreground">
                {t("uploadHelp")}
              </p>
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
        <LibraryEmpty
          icon={Library}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                className="rounded-md"
                onClick={() => {
                  setBrowseMode("sources");
                  setAddTab("search");
                }}
              >
                {t("searchSourcesTab")}
              </Button>
              <Button
                variant="outline"
                className="rounded-md"
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
        <section
          aria-label={t("collectionRegion")}
          className="flex flex-col gap-5 md:gap-6"
        >
          {itemsPartial ? (
            <LibraryFeedback
              icon={Library}
              title={t("partialWarningTitle")}
              description={t("partialWarning")}
              action={retryButton}
            />
          ) : null}

          {displayedItems.length === 0 ? (
            <LibraryEmpty
              icon={SearchX}
              title={t("noMatch")}
              description={t("noMatchDescription")}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-sm"
                  onClick={() => setCollectionQuery("")}
                >
                  {t("resetFilters")}
                </Button>
              }
            />
          ) : (
            <>
              {/* Pen Book grid AuAXZ / dZwIa — desktop only */}
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
                        <article className="flex w-[140px] flex-col gap-2.5">
                          <button
                            type="button"
                            className={cn(
                              "relative h-[186px] w-[140px] overflow-hidden rounded-[9px] bg-ferry-surface-2 text-left",
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
                            onDoubleClick={() => setDetailItem(item)}
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

              {/* Mobile mF0028: collection as BookRows (no Récents heading) */}
              <div className="flex w-full flex-col md:hidden" data-testid="library-mobile-rows">
                <ul className="flex flex-col">
                  {pageSlice.items.map((item) => (
                    <li key={item.id}>
                      <BookRow
                        item={item}
                        selected={selectedId === item.id}
                        canDeliver={canDeliver}
                        onSelect={() => selectBook(item)}
                        onOpenDetail={() => setDetailItem(item)}
                        onDeliver={() => openDeliver(item)}
                        t={t}
                        tCommon={tCommon}
                      />
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pen Book list — Récents simultaneous with grid (desktop) */}
              <div
                data-testid="library-recent-section"
                className="hidden w-full flex-col md:flex"
              >
                <h2 className="text-sm font-medium text-muted-foreground">
                  {t("recentSection")}
                </h2>
                <ul className="flex flex-col">
                  {(recentItems.length > 0
                    ? recentItems
                    : pageSlice.items.slice(0, 3)
                  ).map((item) => (
                    <li key={item.id}>
                      <BookRow
                        item={item}
                        selected={selectedId === item.id}
                        canDeliver={canDeliver}
                        onSelect={() => selectBook(item)}
                        onOpenDetail={() => setDetailItem(item)}
                        onDeliver={() => openDeliver(item)}
                        t={t}
                        tCommon={tCommon}
                      />
                    </li>
                  ))}
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
          setItems((prev) =>
            prev.map((it) => (it.id === updated.id ? updated : it))
          );
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
