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
  Plus,
  Search,
  SearchX,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookDetailDialog } from "@/components/app/library/book-detail-dialog";
import { BookGridItem } from "@/components/app/library/book-grid-item";
import { BookRow } from "@/components/app/library/book-row";
import { DeliverDialog } from "@/components/app/library/deliver-dialog";
import { LibraryEmptyState } from "@/components/app/library/library-empty-state";
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
} from "@/components/app/library/library-collection";
import { SearchCoverImage } from "@/components/app/library/cover-image";
import { UploadDropzone } from "@/components/app/library/upload-dropzone";
import { PageHeader } from "@/components/app/page-header";
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
type ViewMode = "grid" | "list";

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
      <Button size="sm" variant="secondary" disabled>
        {t("inLibrary")}
      </Button>
    );
  }
  if (isPending) {
    return (
      <Button size="sm" variant="ghost" disabled>
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
  const tDetail = useTranslations("bookDetail");
  const { call } = useApiClient();
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
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
  const [pendingDelete, setPendingDelete] = useState<LibraryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [browseMode, setBrowseMode] = useState<BrowseMode>("mine");
  const [addTab, setAddTab] = useState<AddTab>("search");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const canDeliver = devices.length > 0;
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const headerSendEnabled = Boolean(selectedItem && canDeliver);
  const headerDescription = t("headerDescription");
  const showMobileEmptyTop =
    items.length === 0 && !itemsUnavailable && browseMode === "mine";

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

  function openSourcesSearch() {
    setBrowseMode("sources");
    setAddTab("search");
  }

  function openImport() {
    setBrowseMode("sources");
    setAddTab("import");
  }

  function backToLibrary() {
    setBrowseMode("mine");
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await call(`/api/v1/books/${pendingDelete.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((it) => it.id !== pendingDelete.id));
      if (selectedId === pendingDelete.id) setSelectedId(null);
      if (detailItem?.id === pendingDelete.id) setDetailItem(null);
      toast.success(tDetail("toastDeleted"));
      setPendingDelete(null);
    } catch {
      toast.error(tDetail("toastDeleteFailed"));
    } finally {
      setDeleting(false);
    }
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
      variant="ghost"
      onClick={handleRetry}
      disabled={retrying}
      className="w-fit"
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
            variant="ghost"
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
            variant="ghost"
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
    <>
      <Label htmlFor="library-header-search" className="sr-only">
        {browseMode === "mine"
          ? t("collectionSearchLabel")
          : t("searchSourcesLabel")}
      </Label>
      <SearchInput
        ref={searchInputRef}
        id="library-header-search"
        value={headerSearchValue}
        onChange={(event) => onHeaderSearchChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onHeaderSearchSubmit();
        }}
        placeholder={headerSearchPlaceholder}
        autoComplete="off"
        spellCheck={false}
        disabled={browseMode === "sources" && searching}
      />
    </>
  );

  const headerActions = (
    <>
      {!isMobile ? searchField : null}
      <Button
        type="button"
        variant="ghost"
        onClick={browseMode === "mine" ? openSourcesSearch : backToLibrary}
      >
        {browseMode === "mine" ? t("searchSourcesTab") : t("modeMine")}
      </Button>
      <Button
        type="button"
        data-testid="library-header-send"
        disabled={!headerSendEnabled}
        aria-disabled={!headerSendEnabled}
        onClick={handleHeaderSend}
      >
        {t("deliver")}
      </Button>
    </>
  );

  const viewChips = (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label={t("viewModeLabel")}
    >
      <button
        type="button"
        className={cn(
          buttonVariants({
            variant: viewMode === "grid" ? "default" : "ghost",
          })
        )}
        aria-pressed={viewMode === "grid"}
        onClick={() => setViewMode("grid")}
      >
        {t("chipGrid")}
      </button>
      <button
        type="button"
        className={cn(
          buttonVariants({
            variant: viewMode === "list" ? "default" : "ghost",
          })
        )}
        aria-pressed={viewMode === "list"}
        onClick={() => setViewMode("list")}
      >
        {t("chipList")}
      </button>
      <span className="sr-only" aria-live="polite">
        {viewMode === "grid" ? t("gridView") : t("listView")}
      </span>
    </div>
  );

  const toolsRow = (
    <div
      className="flex flex-wrap items-center justify-between gap-3"
      data-testid="library-tools"
    >
      <p className="text-sm font-medium text-foreground">
        {itemsPartial
          ? t("toolsCountPartial", { count: displayedItems.length })
          : t("toolsCount", { count: displayedItems.length })}
      </p>
      {viewChips}
    </div>
  );

  const bookList = (
    <ul className="flex flex-col" data-testid="library-book-list">
      {pageSlice.items.map((item) => (
        <li key={item.id}>
          <BookRow
            item={item}
            selected={selectedId === item.id}
            canDeliver={canDeliver}
            onSelect={() => selectBook(item)}
            onOpenDetail={() => setDetailItem(item)}
            onDeliver={() => openDeliver(item)}
            onDelete={() => setPendingDelete(item)}
          />
        </li>
      ))}
    </ul>
  );

  const bookGrid = (
    <RevealGroup stagger={prefersReducedMotion ? 0 : 0.04}>
      <ul
        data-testid="library-book-grid"
        className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-5 gap-y-6"
      >
        {pageSlice.items.map((item) => (
          <li key={item.id}>
            <RevealItem>
              <BookGridItem
                item={item}
                selected={selectedId === item.id}
                authorFallback={tCommon("dash")}
                onSelect={() => selectBook(item)}
                onOpenDetail={() => setDetailItem(item)}
              />
            </RevealItem>
          </li>
        ))}
      </ul>
    </RevealGroup>
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

      {/* Pen Header/Page — desktop; mobile empty Top when collection empty */}
      <div className="hidden md:block">
        <PageHeader
          title={title}
          description={headerDescription || description}
          action={headerActions}
        />
      </div>

      {showMobileEmptyTop ? (
        <div className="flex flex-col gap-2 px-5 pt-6 md:hidden">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{tBrand("name")}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("importShort")}
              onClick={openImport}
            >
              <Plus />
            </Button>
          </div>
          <h1 className="text-[22px] font-semibold text-foreground">{title}</h1>
          <p className="text-[13px] font-medium text-muted-foreground">
            {t("emptyMobileSubtitle")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 md:hidden">
          <p className="text-sm font-medium text-muted-foreground">
            {tBrand("name")}
          </p>
          <h1 className="text-[22px] font-semibold text-foreground">{title}</h1>
          <p className="text-[13px] font-medium text-muted-foreground">
            {headerDescription || description}
          </p>
          <div className="flex flex-col gap-2 pt-1">
            {isMobile ? searchField : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={
                  browseMode === "mine" ? openSourcesSearch : backToLibrary
                }
              >
                {browseMode === "mine" ? t("searchSourcesTab") : t("modeMine")}
              </Button>
              <Button
                type="button"
                data-testid="library-header-send-mobile"
                disabled={!headerSendEnabled}
                aria-disabled={!headerSendEnabled}
                onClick={handleHeaderSend}
              >
                {t("deliver")}
              </Button>
            </div>
          </div>
        </div>
      )}

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

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={addTab === "search" ? "default" : "ghost"}
              aria-pressed={addTab === "search"}
              onClick={() => setAddTab("search")}
            >
              {t("searchSourcesTab")}
            </Button>
            <Button
              type="button"
              variant={addTab === "import" ? "default" : "ghost"}
              aria-pressed={addTab === "import"}
              onClick={() => setAddTab("import")}
            >
              {t("importTab")}
            </Button>
          </div>

          {addTab === "search" ? (
            <div className="flex flex-col gap-5">
              <p className="max-w-2xl text-sm text-muted-foreground">
                {t("searchHelp")}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  onClick={() => void runSearch()}
                  disabled={searching || !query.trim()}
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
                                <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-sm bg-secondary">
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
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="max-w-2xl text-sm text-muted-foreground">
                {t("uploadHelp")}
              </p>
              <UploadDropzone
                onUploaded={(item) => {
                  setItems((prev) => [item, ...prev]);
                  setBrowseMode("mine");
                }}
              />
            </div>
          )}
        </section>
      ) : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 md:px-0">
          <LibraryEmptyState
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            actions={
              <>
                <Button onClick={openImport}>{t("importShort")}</Button>
                <Button variant="ghost" onClick={openSourcesSearch}>
                  {t("searchSourcesTab")}
                </Button>
              </>
            }
          />
        </div>
      ) : (
        <section
          aria-label={t("collectionRegion")}
          className="flex flex-col gap-6"
        >
          {itemsPartial ? (
            <LibraryFeedback
              icon={Library}
              title={t("partialWarningTitle")}
              description={t("partialWarning")}
              action={retryButton}
            />
          ) : null}

          {toolsRow}

          {displayedItems.length === 0 ? (
            <LibraryEmpty
              icon={SearchX}
              title={t("noMatch")}
              description={t("noMatchDescription")}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCollectionQuery("")}
                >
                  {t("resetFilters")}
                </Button>
              }
            />
          ) : (
            <>
              {viewMode === "grid" ? bookGrid : bookList}
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

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{tDetail("confirmTitle")}</DialogTitle>
            <DialogDescription>{tDetail("confirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="animate-spin" /> : null}
              {tDetail("confirmButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
