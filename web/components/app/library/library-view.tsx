"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { BookOpen, LayoutGrid, List, Loader2, Search, SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/app/empty-state";
import { BookDetailDialog } from "@/components/app/library/book-detail-dialog";
import { Reveal } from "@/components/motion/reveal";
import { useApiClient } from "@/lib/api-client";
import type { Device, LibraryItem, SearchResult } from "@/lib/types";

type ViewMode = "grid" | "list";
type SortBy = "title" | "author" | "added";
type SourceFilter = "all" | "linked" | "manual";

export function LibraryView({
  initialItems,
  itemsUnavailable,
  devices,
}: {
  initialItems: LibraryItem[];
  itemsUnavailable: boolean;
  devices: Device[];
}) {
  const t = useTranslations("library");
  const { call } = useApiClient();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [items, setItems] = useState(initialItems);
  const [detailItem, setDetailItem] = useState<LibraryItem | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortBy>("added");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const languages = useMemo(
    () => Array.from(new Set(items.map((item) => item.language).filter((v): v is string => !!v))),
    [items]
  );
  const formats = useMemo(
    () => Array.from(new Set(items.map((item) => item.original_format))),
    [items]
  );

  const displayedItems = useMemo(() => {
    let list = items;
    if (languageFilter !== "all") {
      list = list.filter((item) => item.language === languageFilter);
    }
    if (formatFilter !== "all") {
      list = list.filter((item) => item.original_format === formatFilter);
    }
    if (sourceFilter !== "all") {
      list = list.filter((item) =>
        sourceFilter === "linked" ? item.source_id !== null : item.source_id === null
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "author") return a.author.localeCompare(b.author);
      return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
    });
  }, [items, languageFilter, formatFilter, sourceFilter, sortBy]);

  async function runSearch() {
    if (!query.trim()) return;
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
      const added = await call<LibraryItem | { gateway_job_id: string }>("/api/v1/books", {
        method: "POST",
        body: JSON.stringify({
          source: result.source,
          result_id: result.result_id,
          result,
        }),
      });
      if ("gateway_job_id" in added) {
        toast.success(t("toastFetchStarted"));
      } else {
        setItems((prev) => [added, ...prev]);
        toast.success(t("toastAdded", { title: added.title }));
      }
      setResults((prev) =>
        prev
          ? prev.map((candidate) =>
              candidate.source === result.source && candidate.result_id === result.result_id
                ? { ...candidate, owned: true }
                : candidate
            )
          : prev
      );
    } catch {
      toast.error(t("toastAddFailed"));
    } finally {
      setAddingId(null);
    }
  }

  function sourceBadgeLabel(item: LibraryItem) {
    return item.source_id ? t("sourceLinked") : t("sourceManual");
  }

  function sourceLabel(source: string) {
    if (source === "gutenberg") return t("sourceGutenberg");
    if (source === "standard_ebooks") return t("sourceStandardEbooks");
    if (source === "upload") return t("sourceManual");
    if (source.startsWith("gateway:")) return t("sourceLinked");
    return source;
  }

  function resetFilters() {
    setLanguageFilter("all");
    setFormatFilter("all");
    setSourceFilter("all");
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-4">
          <h2 className="font-heading text-lg font-medium">{t("addBooksTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("searchHelp")}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && runSearch()}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <Button onClick={runSearch} disabled={searching}>
            {searching ? <Loader2 className="animate-spin" /> : <Search />}
            {t("search")}
          </Button>
        </div>

        {searching && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-border/60 py-10 text-sm text-muted-foreground"
          >
            <Loader2 className="size-4 animate-spin" />
            {t("searching")}
          </motion.div>
        )}

        {!searching && results !== null && (
          <Reveal className="mt-4">
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noResultsHint")}</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12" />
                      <TableHead>{t("title")}</TableHead>
                      <TableHead>{t("author")}</TableHead>
                      <TableHead>{t("source")}</TableHead>
                      <TableHead>{t("format")}</TableHead>
                      <TableHead className="text-right">{t("action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => {
                      const resultKey = `${result.source}:${result.result_id}`;
                      return (
                        <TableRow key={resultKey}>
                          <TableCell>
                            <div className="flex size-10 items-center justify-center overflow-hidden rounded bg-muted">
                              {result.cover_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={result.cover_url}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <BookOpen className="size-4 text-muted-foreground" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span>{result.title}</span>
                              {result.owned && <Badge variant="secondary">{t("owned")}</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{result.author}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{sourceLabel(result.source)}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground uppercase">
                            {result.format}
                          </TableCell>
                          <TableCell className="text-right">
                            {result.owned ? (
                              <Button size="sm" variant="outline" disabled>
                                {t("inLibrary")}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={addingId === resultKey}
                                onClick={() => addResult(result)}
                              >
                                {addingId === resultKey ? (
                                  <Loader2 className="animate-spin" />
                                ) : null}
                                {t("add")}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Reveal>
        )}
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-medium">{t("myLibrary")}</h2>
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={sortBy} onValueChange={(value) => setSortBy((value as SortBy) ?? "added")}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="added">{t("sortAdded")}</SelectItem>
                  <SelectItem value="title">{t("sortTitle")}</SelectItem>
                  <SelectItem value="author">{t("sortAuthor")}</SelectItem>
                </SelectContent>
              </Select>

              {languages.length > 0 && (
                <Select value={languageFilter} onValueChange={(value) => setLanguageFilter(value ?? "all")}>
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("filterLanguageAll")}</SelectItem>
                    {languages.map((language) => (
                      <SelectItem key={language} value={language}>
                        {language}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {formats.length > 1 && (
                <Select value={formatFilter} onValueChange={(value) => setFormatFilter(value ?? "all")}>
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("filterFormatAll")}</SelectItem>
                    {formats.map((format) => (
                      <SelectItem key={format} value={format}>
                        {format.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select
                value={sourceFilter}
                onValueChange={(value) => setSourceFilter((value as SourceFilter) ?? "all")}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filterSourceAll")}</SelectItem>
                  <SelectItem value="linked">{t("sourceLinked")}</SelectItem>
                  <SelectItem value="manual">{t("sourceManual")}</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-1">
                <Button
                  size="icon-sm"
                  variant={viewMode === "grid" ? "secondary" : "outline"}
                  onClick={() => setViewMode("grid")}
                  aria-label={t("gridView")}
                >
                  <LayoutGrid />
                </Button>
                <Button
                  size="icon-sm"
                  variant={viewMode === "list" ? "secondary" : "outline"}
                  onClick={() => setViewMode("list")}
                  aria-label={t("listView")}
                >
                  <List />
                </Button>
              </div>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={t("emptyTitle")}
            description={itemsUnavailable ? t("emptyUnavailable") : t("emptyDescription")}
          />
        ) : displayedItems.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={t("noMatch")}
            action={
              <Button variant="outline" size="sm" onClick={resetFilters}>
                {t("resetFilters")}
              </Button>
            }
          />
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayedItems.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <div className="aspect-3/4 w-full overflow-hidden rounded-lg bg-muted">
                    {item.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.cover_url}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <BookOpen className="size-10 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="line-clamp-2 font-medium">{item.title}</p>
                    <p className="line-clamp-1 text-sm text-muted-foreground">{item.author}</p>
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{item.original_format.toUpperCase()}</Badge>
                    <Badge variant="outline">{sourceBadgeLabel(item)}</Badge>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setDetailItem(item)}>
                    {t("details")}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("title")}</TableHead>
                  <TableHead>{t("author")}</TableHead>
                  <TableHead>{t("format")}</TableHead>
                  <TableHead>{t("language")}</TableHead>
                  <TableHead>{t("added")}</TableHead>
                  <TableHead className="text-right">{t("action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell className="text-muted-foreground">{item.author}</TableCell>
                    <TableCell className="text-muted-foreground uppercase">
                      {item.original_format}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.language ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(item.added_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setDetailItem(item)}>
                        {t("details")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <BookDetailDialog
        item={detailItem}
        devices={devices}
        onOpenChange={(open) => !open && setDetailItem(null)}
        onUpdated={(updated) => {
          setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
          setDetailItem(updated);
        }}
        onDeleted={(id) => {
          setItems((prev) => prev.filter((it) => it.id !== id));
        }}
      />
    </div>
  );
}
