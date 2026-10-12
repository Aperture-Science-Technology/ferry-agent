"use client";

import { DeliveryFeedback } from "@/components/app/deliveries/delivery-feedback";
import type { DeliveryJob } from "@/lib/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, useReducedMotion } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
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
  LibraryFeedbackError,
  LibraryFeedbackLoading,
  LibraryFeedbackPartial,
} from "@/components/app/library/library-feedback";
import {
  applyLibraryItemsRefreshResult,
  filterAndSortLibraryItems,
  LIBRARY_COLLECTION_PAGE_SIZE,
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

import { useUrlQuery, updateUrlQuery } from "@/lib/use-url-query";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkActions } from "./bulk-actions";
import { FilterBar } from "@/components/app/filter-bar";
import { useLibraryFilterFields } from "./library-filter-fields";
import { SEARCH_PAGE_SIZE, updateLibraryQuery, useLibraryQuery } from "./library-query";

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
  const tBulk = useTranslations("enhance.bulk");
  const tCommon = useTranslations("common");
  const tBrand = useTranslations("brand");
  const tDetail = useTranslations("bookDetail");
  const { call } = useApiClient();
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const urlQuery = useUrlQuery();
  const criteria = useLibraryQuery();
  const filterFields = useLibraryFilterFields(criteria);
  const browseMode = criteria.mode;
  const [draft, setDraft] = useState({ original: criteria.query, value: criteria.query });
  if (draft.original !== criteria.query) {
    setDraft({ original: criteria.query, value: criteria.query });
  }
  const query = draft.original === criteria.query ? draft.value : criteria.query;
  function setQuery(value: string) { setDraft({ original: criteria.query, value }); }
  const collectionQuery = criteria.query;
  function setCollectionQuery(value: string) {
    updateLibraryQuery({ mode: "mine", q: value, page: null });
  }
  function setBrowseMode(mode: BrowseMode) {
    if (mode !== browseMode) updateLibraryQuery({ mode }, true);
  }
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [searchError, setSearchError] = useState(false);
  const [hasNextSearchPage, setHasNextSearchPage] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [pendingJobs, setPendingJobs] = useState<Record<string, string>>({});
  const [items, setItems] = useState(initialItems);
  const [detailItem, setDetailItem] = useState<LibraryItem | null>(null);
  const [lastDelivery, setLastDelivery] = useState<DeliveryJob | null>(null);
  const [deliverItem, setDeliverItem] = useState<LibraryItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LibraryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [partialDismissed, setPartialDismissed] = useState(false);
  const [unavailableDismissed, setUnavailableDismissed] = useState(false);
  const [localAddTab, setLocalAddTab] = useState<AddTab>("search");
  const addTab = urlQuery.get("action") === "import" ? "import" : localAddTab;
  function setAddTab(tab: AddTab) { updateUrlQuery({ action: null }); setLocalAddTab(tab); }
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

  const collectionPage = criteria.page;

  const displayedItems = useMemo(
    () =>
      filterAndSortLibraryItems(items, {
        textQuery: collectionQuery,
        languageFilter: criteria.language || "all",
        formatFilter: criteria.format,
        sourceFilter: criteria.collectionSource,
        sortBy: criteria.collectionSort,
      }),
    [items, collectionQuery, criteria.language, criteria.format, criteria.collectionSource, criteria.collectionSort]
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

  function setCollectionPage(nextPage: number) {
    updateLibraryQuery({ page: String(nextPage) });
  }

  const selectedBooks = items.filter(item => selection.has(item.id));
  const pageSelected = pageSlice.items.length > 0 && pageSlice.items.every(item => selection.has(item.id));
  function toggleSelection(id: string, checked: boolean) {
    setSelection(previous => { const next = new Set(previous); if (checked) next.add(id); else next.delete(id); return next; });
  }
  function selectionBox(item: LibraryItem) {
    return <Checkbox aria-label={tBulk("selectBook", { title: item.title })} checked={selection.has(item.id)} onCheckedChange={checked => toggleSelection(item.id, checked)} />;
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

  const searchBody = JSON.stringify(criteria.request);
  useEffect(() => {
    if (browseMode !== "sources") return;
    const controller = new AbortController();
    async function search() {
      if (!JSON.parse(searchBody).query.trim()) {
        setResults(null);
        setSearching(false);
        return;
      }
      setSearching(true);
      setSearchError(false);
      setResults(null);
      try {
        const found = await call<SearchResult[]>("/api/v1/books/search", {
          method: "POST",
          body: searchBody,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setResults(found.slice(0, SEARCH_PAGE_SIZE));
        setHasNextSearchPage(found.length > SEARCH_PAGE_SIZE);
      } catch {
        if (controller.signal.aborted) return;
        setSearchError(true);
        toast.error(t("toastSearchFailed"));
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }
    void search();
    return () => controller.abort();
  }, [browseMode, searchBody, searchAttempt, call, t]);

  function runSearch() {
    if (!query.trim()) return;
    setAddTab("search");
    updateLibraryQuery({ mode: "sources", q: query, page: null });
    setSearchAttempt((value) => value + 1);
  }

  function changeFilters(values: Record<string, string | null>) {
    updateLibraryQuery({ ...values, mode: browseMode, page: null });
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
    setPartialDismissed(false);
    setUnavailableDismissed(false);
    router.refresh();
  }

  const showPartial = itemsPartial && !partialDismissed;
  const showUnavailable =
    itemsUnavailable && items.length === 0 && !unavailableDismissed;

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
          {selectionBox(item)}
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
        className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-6"
      >
        {pageSlice.items.map((item) => (
          <li key={item.id}>
            <RevealItem>
              {selectionBox(item)}
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
        <div className="flex flex-col gap-2 px-5 py-6 md:hidden">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {tBrand("name")}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-[51px] rounded-full border border-border-strong bg-accent"
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

          <BulkActions items={selectedBooks} devices={devices}
            onDeleted={ids => { setItems(previous => previous.filter(item => !ids.includes(item.id))); if (detailItem && ids.includes(detailItem.id)) setDetailItem(null); }}
            onFinished={ids => setSelection(previous => new Set([...previous].filter(id => !ids.includes(id))))} />

      {lastDelivery?.method === "email" ? (
        <DeliveryFeedback method="email" title={t("emailRequested")} />
      ) : null}

      {showUnavailable ? (
        <LibraryFeedbackError
          title={t("emptyUnavailableTitle")}
          description={t("emptyUnavailable")}
          dismissLabel={tCommon("dismiss")}
          onDismiss={() => setUnavailableDismissed(true)}
          retryLabel={t("retryLoad")}
          onRetry={handleRetry}
        />
      ) : browseMode === "sources" ? (
        <section aria-label={t("addRegion")} className="flex flex-col gap-5">
          {showPartial && items.length > 0 ? (
            <LibraryFeedbackPartial
              title={t("partialWarningTitle")}
              description={t("partialWarning")}
              ignoreLabel={tCommon("ignore")}
              onIgnore={() => setPartialDismissed(true)}
              refreshLabel={t("retryLoad")}
              onRefresh={handleRetry}
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

              <FilterBar fields={filterFields} search={{ label: headerSearchPlaceholder, value: headerSearchValue, external: true }} count={results?.length ?? null} onChange={changeFilters} onReset={() => updateLibraryQuery({ mode: browseMode }, true)} label={t("filtersLabel")} />
              {searchError && !searching ? (
                <p role="alert">{t("toastSearchFailed")}</p>
              ) : null}

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
                  <LibraryFeedbackLoading
                    title={t("feedbackLoadingTitle")}
                    description={t("searching")}
                  >
                    <div className="mt-2 grid w-full gap-3 sm:grid-cols-2">
                      <Skeleton className="h-16 w-full rounded-md" />
                      <Skeleton className="h-16 w-full rounded-md" />
                    </div>
                  </LibraryFeedbackLoading>
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
              {!searching && results !== null && (criteria.page > 1 || hasNextSearchPage) ? (
                <nav className="flex items-center gap-3" aria-label={t("searchPagination")}>
                  <Button variant="ghost" disabled={criteria.page <= 1}
                    onClick={() => updateLibraryQuery({ page: String(criteria.page - 1) })}>
                    <ChevronLeft />{t("paginationPrevious")}
                  </Button>
                  <span aria-live="polite">{t("searchPage", { page: criteria.page })}</span>
                  <Button variant="ghost" disabled={!hasNextSearchPage}
                    onClick={() => updateLibraryQuery({ page: String(criteria.page + 1) })}>
                    {t("paginationNext")}<ChevronRight />
                  </Button>
                </nav>
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
          {showPartial ? (
            <LibraryFeedbackPartial
              title={t("partialWarningTitle")}
              description={t("partialWarning")}
              ignoreLabel={tCommon("ignore")}
              onIgnore={() => setPartialDismissed(true)}
              refreshLabel={t("retryLoad")}
              onRefresh={handleRetry}
            />
          ) : null}

          {toolsRow}
          <div className="flex flex-wrap items-center gap-2">
            <Checkbox id="library-select-page" checked={pageSelected} indeterminate={!pageSelected && pageSlice.items.some(item => selection.has(item.id))}
              disabled={!pageSlice.items.length} onCheckedChange={checked => setSelection(previous => {
                const next = new Set(previous); pageSlice.items.forEach(item => { if (checked) next.add(item.id); else next.delete(item.id); }); return next;
              })} />
            <Label htmlFor="library-select-page">{tBulk("selectPage")}</Label>
          </div>

          <FilterBar fields={filterFields} search={{ label: headerSearchPlaceholder, value: headerSearchValue, external: true }} count={displayedItems.length} onChange={changeFilters} onReset={() => updateLibraryQuery({ mode: browseMode }, true)} label={t("filtersLabel")} />

          {displayedItems.length === 0 ? (
            <LibraryEmpty
              icon={SearchX}
              title={t("noMatch")}
              description={t("noMatchDescription")}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateLibraryQuery({ mode: "mine" }, true)}
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
        item={detailItem ?? items.find(item => item.id === urlQuery.get("book")) ?? null}
        devices={devices}
        onOpenChange={(open) => { if (!open) { setDetailItem(null); updateUrlQuery({ book: null }); } }}
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
        onDelivered={(job) => {
          setLastDelivery(job);
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
              variant="destructive"
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
