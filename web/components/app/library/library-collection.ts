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

export function isManualLibraryItem(item: Pick<FilterableLibraryItem, "source_ref">): boolean {
  return !item.source_ref;
}

export function isLinkedLibraryItem(item: Pick<FilterableLibraryItem, "source_ref">): boolean {
  return Boolean(item.source_ref?.startsWith("gateway:"));
}

export function filterAndSortLibraryItems<T extends FilterableLibraryItem>(
  items: T[],
  options: {
    languageFilter: string;
    formatFilter: string;
    sourceFilter: SourceFilter;
    sortBy: SortBy;
  }
): T[] {
  let list = items;
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
