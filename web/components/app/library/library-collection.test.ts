/**
 * Regression: partial pagination must not look like a complete/empty library.
 * Run: node --experimental-strip-types --test components/app/library/library-collection.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterAndSortLibraryItems,
  mergeLibraryFetch,
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
});
