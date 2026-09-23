/**
 * Regression: partial pagination must not look like a complete/empty library.
 * Run: node --experimental-strip-types --test components/app/library/library-collection.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCollectionHighlights,
  filterAndSortLibraryItems,
  hasActiveLibraryFilters,
  mergeLibraryFetch,
  pageAfterLibraryCriteriaChange,
  paginateLibraryItems,
  applyLibraryItemsRefreshResult,
  libraryCollectionPageState,
} from "./library-collection.ts";

describe("mergeLibraryFetch", () => {
  it("marks unavailable when the first page fails (not an empty library)", () => {
    const result = mergeLibraryFetch(null, []);
    assert.deepEqual(result, {
      items: [],
      unavailable: true,
      partial: false,
    });
  });

  it("keeps first-page items and flags partial when page 2 fails", () => {
    const first = {
      items: [{ id: "a" }, { id: "b" }],
      total: 3,
      limit: 2,
    };
    const result = mergeLibraryFetch(first, [null]);
    assert.equal(result.unavailable, false);
    assert.equal(result.partial, true);
    assert.deepEqual(
      result.items.map((item) => item.id),
      ["a", "b"]
    );
  });

  it("returns a complete collection when all pages succeed", () => {
    const first = {
      items: [{ id: "a" }, { id: "b" }],
      total: 3,
      limit: 2,
    };
    const second = {
      items: [{ id: "c" }],
      total: 3,
      limit: 2,
    };
    const result = mergeLibraryFetch(first, [second]);
    assert.deepEqual(result, {
      items: [{ id: "a" }, { id: "b" }, { id: "c" }],
      unavailable: false,
      partial: false,
    });
  });

  it("does not treat a partial collection as artificially complete", () => {
    const first = {
      items: [{ id: "a" }],
      total: 5,
      limit: 1,
    };
    const result = mergeLibraryFetch(first, [null]);
    assert.equal(result.partial, true);
    assert.equal(result.unavailable, false);
    assert.equal(result.items.length, 1);
    assert.notEqual(result.items.length, first.total);
  });
});

describe("filterAndSortLibraryItems", () => {
  const sample = [
    {
      title: "Beta",
      author: "Zed",
      language: "fr",
      original_format: "epub",
      source_ref: null,
      added_at: "2026-01-02T00:00:00Z",
    },
    {
      title: "Alpha",
      author: "Ann",
      language: "en",
      original_format: "pdf",
      source_ref: "gateway:gw1:x",
      added_at: "2026-01-01T00:00:00Z",
    },
  ];

  it("preserves the full set identity when filters match nothing", () => {
    const filtered = filterAndSortLibraryItems(sample, {
      languageFilter: "de",
      formatFilter: "all",
      sourceFilter: "all",
      sortBy: "title",
    });
    assert.equal(filtered.length, 0);
    assert.equal(sample.length, 2);
  });

  it("sorts by title without inventing items", () => {
    const filtered = filterAndSortLibraryItems(sample, {
      languageFilter: "all",
      formatFilter: "all",
      sourceFilter: "all",
      sortBy: "title",
    });
    assert.deepEqual(
      filtered.map((item) => item.title),
      ["Alpha", "Beta"]
    );
  });

  it("filters by title and author text without inventing items", () => {
    const byTitle = filterAndSortLibraryItems(sample, {
      textQuery: "alp",
      languageFilter: "all",
      formatFilter: "all",
      sourceFilter: "all",
      sortBy: "added",
    });
    assert.deepEqual(
      byTitle.map((item) => item.title),
      ["Alpha"]
    );

    const byAuthor = filterAndSortLibraryItems(sample, {
      textQuery: "zed",
      languageFilter: "all",
      formatFilter: "all",
      sourceFilter: "all",
      sortBy: "added",
    });
    assert.deepEqual(
      byAuthor.map((item) => item.title),
      ["Beta"]
    );

    const none = filterAndSortLibraryItems(sample, {
      textQuery: "missing-book",
      languageFilter: "all",
      formatFilter: "all",
      sourceFilter: "all",
      sortBy: "added",
    });
    assert.equal(none.length, 0);
    assert.equal(sample.length, 2);
  });
});

describe("paginateLibraryItems", () => {
  const items = Array.from({ length: 50 }, (_, index) => ({ id: index + 1 }));

  it("clamps page into a bounded range", () => {
    const low = paginateLibraryItems(items, 0, 24);
    assert.equal(low.page, 1);
    assert.equal(low.rangeStart, 1);
    assert.equal(low.rangeEnd, 24);

    const high = paginateLibraryItems(items, 99, 24);
    assert.equal(high.page, 3);
    assert.equal(high.pageCount, 3);
    assert.equal(high.rangeStart, 49);
    assert.equal(high.rangeEnd, 50);
    assert.deepEqual(
      high.items.map((item) => item.id),
      [49, 50]
    );
  });

  it("keeps an empty list on page 1 with a zero range", () => {
    const empty = paginateLibraryItems([], 4, 24);
    assert.deepEqual(empty, {
      items: [],
      page: 1,
      pageCount: 1,
      total: 0,
      rangeStart: 0,
      rangeEnd: 0,
    });
  });
});

describe("pageAfterLibraryCriteriaChange", () => {
  it("resets to page 1 when filters change via the helper", () => {
    assert.equal(pageAfterLibraryCriteriaChange(), 1);
  });
});

describe("libraryCollectionPageState", () => {
  it("resets an active filter change back to page 1 (not the stale page)", () => {
    const onPage3 = { criteriaKey: "q=\0all\0all\0all\0added", page: 3 };
    const afterFilter = libraryCollectionPageState(
      onPage3,
      "hugo\0all\0all\0all\0added"
    );
    assert.deepEqual(afterFilter, {
      criteriaKey: "hugo\0all\0all\0all\0added",
      page: 1,
    });
    assert.notEqual(afterFilter.page, onPage3.page);
  });

  it("keeps the current page when criteria are unchanged", () => {
    const same = { criteriaKey: "a\0all\0all\0all\0title", page: 2 };
    assert.equal(libraryCollectionPageState(same, same.criteriaKey), same);
  });
});

describe("applyLibraryItemsRefreshResult", () => {
  it("keeps previous items when a refresh fails (not an empty library)", () => {
    const previous = [{ id: "a" }, { id: "b" }];
    const outcome = applyLibraryItemsRefreshResult(previous, null);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.keptPrevious, true);
    assert.deepEqual(outcome.items, previous);
    assert.notEqual(outcome.items.length, 0);
  });

  it("replaces items when a refresh succeeds", () => {
    const previous = [{ id: "a" }];
    const fresh = [{ id: "b" }, { id: "c" }];
    const outcome = applyLibraryItemsRefreshResult(previous, fresh);
    assert.deepEqual(outcome, {
      ok: true,
      items: fresh,
      keptPrevious: false,
    });
  });
});

describe("buildCollectionHighlights", () => {
  const loaded = [
    { original_format: "epub", source_ref: null },
    { original_format: "pdf", source_ref: "gateway:gw1:x" },
    { original_format: "epub", source_ref: "gutenberg:1" },
  ];

  it("exposes only reliable derived counts", () => {
    const active = buildCollectionHighlights(loaded, 1, {
      filtersActive: true,
      deviceCount: 2,
    });
    assert.deepEqual(active, {
      totalLoaded: 3,
      matched: 1,
      formatCount: 2,
      sourceKindCount: 3,
      deviceCount: 2,
    });

    const idle = buildCollectionHighlights(loaded, 3, {
      filtersActive: false,
      deviceCount: 0,
    });
    assert.equal(idle.matched, null);
    assert.equal(idle.deviceCount, null);
    assert.equal(idle.formatCount, 2);
  });
});

describe("hasActiveLibraryFilters", () => {
  it("detects text and select filters", () => {
    assert.equal(
      hasActiveLibraryFilters({
        textQuery: "",
        languageFilter: "all",
        formatFilter: "all",
        sourceFilter: "all",
      }),
      false
    );
    assert.equal(
      hasActiveLibraryFilters({
        textQuery: "hugo",
        languageFilter: "all",
        formatFilter: "all",
        sourceFilter: "all",
      }),
      true
    );
  });
});
