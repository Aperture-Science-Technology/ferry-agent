"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { useLibraryQuery } from "./library-query";

export function LibraryFilters({ criteria, onChange }: {
  criteria: ReturnType<typeof useLibraryQuery>;
  onChange: (values: Record<string, string | null>) => void;
}) {
  const t = useTranslations("library");
  const searching = criteria.mode === "sources";
  function selector(label: string, key: string, value: string, options: { value: string; label: string }[]) {
    return (
      <div className="flex flex-col gap-2">
        <Label id={`library-filter-${key}`}>{label}</Label>
        <Select value={value} items={options} onValueChange={(next) => onChange({ [key]: next })}>
          <SelectTrigger aria-labelledby={`library-filter-${key}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <div role="group" aria-label={t("filtersLabel")} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="library-filter-lang">{t("filterLanguageLabel")}</Label>
        <Input id="library-filter-lang" value={criteria.language} placeholder={t("filterLanguageAll")}
          onChange={(event) => onChange({ lang: event.target.value })} />
      </div>
      {selector(t("filterFormatLabel"), "fmt", criteria.format, [
        { value: "all", label: t("filterFormatAll") },
        ...["epub", "mobi", "azw3", "pdf"].map((value) => ({ value, label: value.toUpperCase() })),
      ])}
      {selector(t("filterSourceLabel"), "src", searching ? criteria.source : criteria.collectionSource, [
        { value: "all", label: t("filterSourceAll") },
        ...(searching ? [
          { value: "gutenberg", label: t("sourceGutenberg") },
          { value: "standard_ebooks", label: t("sourceStandardEbooks") },
          { value: "gateway", label: t("sourceGateway") },
        ] : [
          { value: "linked", label: t("sourceLinked") },
          { value: "manual", label: t("sourceManual") },
        ]),
      ])}
      {searching ? (
        <div className="flex items-center gap-2">
          <Switch id="library-filter-owned" checked={criteria.owned}
            onCheckedChange={(checked) => onChange({ owned: checked ? "1" : null })} />
          <Label htmlFor="library-filter-owned">{t("filterOwned")}</Label>
        </div>
      ) : null}
      {selector(t("sortLabel"), "sort", searching ? criteria.searchSort : criteria.collectionSort, [
        { value: searching ? "relevance" : "added", label: searching ? t("sortRelevance") : t("sortAdded") },
        { value: "title", label: t("sortTitle") },
        { value: "author", label: t("sortAuthor") },
        ...(searching ? [
          { value: "size", label: t("sortSize") },
          { value: "seeders", label: t("sortSeeders") },
        ] : []),
      ])}
    </div>
  );
}
