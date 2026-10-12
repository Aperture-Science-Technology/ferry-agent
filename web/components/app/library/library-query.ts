"use client";

import { useUrlQuery, updateUrlQuery } from "@/lib/use-url-query";
import type { SearchRequest, SearchSort } from "@/lib/types";
import type { SortBy, SourceFilter } from "./library-collection";

export const SEARCH_PAGE_SIZE = 24;

export function useLibraryQuery() {
  const params = useUrlQuery();
  const mode = params.get("mode") === "mine" ? "mine"
    : params.get("mode") === "sources" || params.has("q") ? "sources" : "mine";
  const query = params.get("q") ?? "";
  const language = params.get("lang") ?? "";
  const format = params.get("fmt") ?? "all";
  const source = params.get("src") ?? "all";
  const owned = params.get("owned") === "1";
  const sort = params.get("sort") ?? (mode === "mine" ? "added" : "relevance");
  const searchSort: SearchSort = ["title", "author", "size", "seeders"].includes(sort)
    ? sort as SearchSort : "relevance";
  const collectionSort: SortBy = sort === "title" || sort === "author" ? sort : "added";
  const collectionSource: SourceFilter = source === "linked" || source === "manual" ? source : "all";
  const rawPage = Number(params.get("page") ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 100000 ? rawPage : 1;
  const request: SearchRequest = {
    query,
    scope: ["legal", "gateways"],
    filters: {
      ...(language ? { language } : {}),
      ...(format !== "all" ? { formats: [format] } : {}),
      ...(source !== "all" ? { sources: [source] } : {}),
      ...(owned ? { owned: true } : {}),
    },
    sort: searchSort,
    limit: SEARCH_PAGE_SIZE + 1,
    offset: (page - 1) * SEARCH_PAGE_SIZE,
  };
  return { mode, query, language, format, source, owned, searchSort, collectionSort, collectionSource, page, request };
}

export function updateLibraryQuery(values: Record<string, string | null>, reset = false) {
  updateUrlQuery(values, reset ? ["q", "lang", "fmt", "src", "owned", "sort", "page"] : []);
}
