/**
 * Pure helpers for library collection fetch / filter presentation.
 * Kept free of React so they can be regression-tested with node:test.
 */

export type LibraryPage<T> = {
  items: T[];
  total: number;
  limit: number;
};

export type LibraryFetchResult<T> = {
  items: T[];
  unavailable: boolean;
  partial: boolean;
};

/**
 * Merge the first page with subsequent pages.
 * - first === null → unavailable (do not treat as empty collection)
 * - a later page === null / missing before totalPages → partial (keep items so far)
 */
export function mergeLibraryFetch<T>(
  first: LibraryPage<T> | null,
  rest: Array<LibraryPage<T> | null | undefined>
): LibraryFetchResult<T> {
  if (first === null) {
    return { items: [], unavailable: true, partial: false };
  }

  const items = [...first.items];
  const limit = Math.max(1, first.limit);
  const totalPages = Math.max(1, Math.ceil(first.total / limit));

  for (let page = 2; page <= totalPages; page += 1) {
    const next = rest[page - 2];
    if (next == null) {
      return { items, unavailable: false, partial: true };
    }
    items.push(...next.items);
  }

  return { items, unavailable: false, partial: false };
}

export type SourceFilter = "all" | "linked" | "manual";
export type SortBy = "title" | "author" | "added";

export type FilterableLibraryItem = {
  title: string;
  author: string;
  language?: string | null;
  original_format: string;
  source_ref?: string | null;
  added_at: string;
};

export type LibrarySourceKind =
  | "manual"
  | "linked"
  | "gutenberg"
  | "standard_ebooks"
  | "other";

/** Default client-side page size for the collection grid/list. */
export const LIBRARY_COLLECTION_PAGE_SIZE = 24;

export function isManualLibraryItem(item: Pick<FilterableLibraryItem, "source_ref">): boolean {
  return !item.source_ref;
}

export function isLinkedLibraryItem(item: Pick<FilterableLibraryItem, "source_ref">): boolean {
  return Boolean(item.source_ref?.startsWith("gateway:"));
}

export function librarySourceKind(
  item: Pick<FilterableLibraryItem, "source_ref">
): LibrarySourceKind {
  const ref = item.source_ref;
  if (!ref) return "manual";
  if (ref.startsWith("gateway:")) return "linked";
  if (ref.startsWith("gutenberg:")) return "gutenberg";
  if (ref.startsWith("standard_ebooks:")) return "standard_ebooks";
  return "other";
}

export function matchesLibraryTextQuery(
  item: Pick<FilterableLibraryItem, "title" | "author">,
  textQuery: string
): boolean {
  const q = textQuery.trim().toLowerCase();
  if (!q) return true;
  return (
    item.title.toLowerCase().includes(q) || item.author.toLowerCase().includes(q)
  );
}

export function hasActiveLibraryFilters(options: {
  textQuery: string;
  languageFilter: string;
  formatFilter: string;
  sourceFilter: SourceFilter;
}): boolean {
  return (
    options.textQuery.trim() !== "" ||
    options.languageFilter !== "all" ||
    options.formatFilter !== "all" ||
    options.sourceFilter !== "all"
  );
}

/**
 * Highlights derived only from loaded items / known devices.
 * Omit a metric by leaving it null when the value is not meaningful.
 */
export type CollectionHighlights = {
  /** Books currently loaded client-side (never invents a server total). */
  totalLoaded: number;
  /** Matched after local search/filters; null when no filter is active. */
  matched: number | null;
  /** Distinct formats among loaded items; null when none loaded. */
  formatCount: number | null;
  /** Distinct source kinds among loaded items; null when none loaded. */
  sourceKindCount: number | null;
  /** Available devices when the caller has a positive count; otherwise null. */
  deviceCount: number | null;
};

export function buildCollectionHighlights(
  loadedItems: Array<Pick<FilterableLibraryItem, "original_format" | "source_ref">>,
  matchedCount: number,
  options: { filtersActive: boolean; deviceCount: number }
): CollectionHighlights {
  const totalLoaded = loadedItems.length;
  if (totalLoaded === 0) {
    return {
      totalLoaded: 0,
      matched: null,
      formatCount: null,
      sourceKindCount: null,
      deviceCount: options.deviceCount > 0 ? options.deviceCount : null,
    };
  }

  const formats = new Set(loadedItems.map((item) => item.original_format));
  const sources = new Set(loadedItems.map(librarySourceKind));

  return {
    totalLoaded,
    matched: options.filtersActive ? matchedCount : null,
    formatCount: formats.size,
    sourceKindCount: sources.size,
    deviceCount: options.deviceCount > 0 ? options.deviceCount : null,
  };
}

export function filterAndSortLibraryItems<T extends FilterableLibraryItem>(
  items: T[],
  options: {
    textQuery?: string;
    languageFilter: string;
    formatFilter: string;
    sourceFilter: SourceFilter;
    sortBy: SortBy;
  }
): T[] {
  let list = items;
  if (options.textQuery?.trim()) {
    list = list.filter((item) => matchesLibraryTextQuery(item, options.textQuery!));
  }
  if (options.languageFilter !== "all") {
    list = list.filter((item) => item.language === options.languageFilter);
  }
  if (options.formatFilter !== "all") {
    list = list.filter((item) => item.original_format === options.formatFilter);
  }
  if (options.sourceFilter === "linked") {
    list = list.filter(isLinkedLibraryItem);
  } else if (options.sourceFilter === "manual") {
    list = list.filter(isManualLibraryItem);
  }

  return [...list].sort((a, b) => {
    if (options.sortBy === "title") return a.title.localeCompare(b.title);
    if (options.sortBy === "author") return a.author.localeCompare(b.author);
    return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
  });
}

export type LibraryPageSlice<T> = {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
};

/**
 * Client-side pagination over an already-filtered list.
 * Clamps `page` into [1, pageCount]; empty lists stay on page 1 with a zero range.
 */
export function paginateLibraryItems<T>(
  items: T[],
  page: number,
  pageSize: number = LIBRARY_COLLECTION_PAGE_SIZE
): LibraryPageSlice<T> {
  const size = Math.max(1, pageSize);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount);

  if (total === 0) {
    return {
      items: [],
      page: 1,
      pageCount: 1,
      total: 0,
      rangeStart: 0,
      rangeEnd: 0,
    };
  }

  const start = (safePage - 1) * size;
  const slice = items.slice(start, start + size);
  return {
    items: slice,
    page: safePage,
    pageCount,
    total,
    rangeStart: start + 1,
    rangeEnd: start + slice.length,
  };
}

/** Page to use after search / filter / sort criteria change. */
export function pageAfterLibraryCriteriaChange(): 1 {
  return 1;
}
