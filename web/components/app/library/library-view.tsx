"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, Loader2, Search, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/app/empty-state";
import { DeliverDialog } from "@/components/app/library/deliver-dialog";
import { useApiClient } from "@/lib/api-client";
import type { Device, LibraryItem, SearchResult } from "@/lib/types";

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
  const [deliverTarget, setDeliverTarget] = useState<LibraryItem | null>(null);

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const found = await call<SearchResult[]>("/api/v1/books/search", {
        method: "POST",
        body: JSON.stringify({ query, scope: ["legal", "gateways"] }),
      });
      setResults(found);
      if (found.length === 0) toast.info(t("toastNoResults"));
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
    } catch {
      toast.error(t("toastAddFailed"));
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="space-y-10">
      <div>
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

        {results !== null && (
          <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
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
                      <TableCell className="font-medium">{result.title}</TableCell>
                      <TableCell className="text-muted-foreground">{result.author}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{result.source}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground uppercase">
                        {result.format}
                      </TableCell>
                      <TableCell className="text-right">
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-4 font-heading text-lg font-medium">{t("myLibrary")}</h2>
        {items.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={t("emptyTitle")}
            description={itemsUnavailable ? t("emptyUnavailable") : t("emptyDescription")}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("title")}</TableHead>
                  <TableHead>{t("author")}</TableHead>
                  <TableHead>{t("format")}</TableHead>
                  <TableHead>{t("added")}</TableHead>
                  <TableHead className="text-right">{t("action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell className="text-muted-foreground">{item.author}</TableCell>
                    <TableCell className="text-muted-foreground uppercase">
                      {item.original_format}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(item.added_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setDeliverTarget(item)}>
                        <Send />
                        {t("deliver")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <DeliverDialog
        item={deliverTarget}
        devices={devices}
        onOpenChange={(open) => !open && setDeliverTarget(null)}
      />
    </div>
  );
}
