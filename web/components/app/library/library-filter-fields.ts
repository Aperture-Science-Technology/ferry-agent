"use client";
import { useTranslations } from "next-intl";
import type { FilterField } from "@/components/app/filter-bar";
import type { useLibraryQuery } from "./library-query";

export function useLibraryFilterFields(criteria: ReturnType<typeof useLibraryQuery>): FilterField[] {
  const t = useTranslations("library");
  const searching = criteria.mode === "sources";
  return [
    { key: "lang", label: t("filterLanguageLabel"), value: criteria.language, defaultValue: "", kind: "text", placeholder: t("filterLanguageAll") },
    { key: "fmt", label: t("filterFormatLabel"), value: criteria.format, defaultValue: "all", options: [
      { value: "all", label: t("filterFormatAll") }, ...["epub", "mobi", "azw3", "pdf"].map(value => ({ value, label: value.toUpperCase() })),
    ] },
    { key: "src", label: t("filterSourceLabel"), value: searching ? criteria.source : criteria.collectionSource, defaultValue: "all", options: [
      { value: "all", label: t("filterSourceAll") },
      ...(searching ? [
        { value: "gutenberg", label: t("sourceGutenberg") }, { value: "standard_ebooks", label: t("sourceStandardEbooks") }, { value: "gateway", label: t("sourceGateway") },
      ] : [{ value: "linked", label: t("sourceLinked") }, { value: "manual", label: t("sourceManual") }]),
    ] },
    ...(searching ? [{ key: "owned", label: t("filterOwned"), value: criteria.owned ? "1" : "", defaultValue: "", kind: "toggle" as const }] : []),
    { key: "sort", label: t("sortLabel"), value: searching ? criteria.searchSort : criteria.collectionSort, defaultValue: searching ? "relevance" : "added", options: [
      { value: searching ? "relevance" : "added", label: searching ? t("sortRelevance") : t("sortAdded") },
      { value: "title", label: t("sortTitle") }, { value: "author", label: t("sortAuthor") },
      ...(searching ? [{ value: "size", label: t("sortSize") }, { value: "seeders", label: t("sortSeeders") }] : []),
    ] },
  ];
}
