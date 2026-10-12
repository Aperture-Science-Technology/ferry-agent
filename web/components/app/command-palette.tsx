"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Search } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiClient } from "@/lib/api-client";
import type { LibraryItem, PaginatedLibraryItems } from "@/lib/types";
import { cn } from "@/lib/utils";

function Commands({ close }: { close: () => void }) {
  const t = useTranslations("enhance.commands");
  const nav = useTranslations("nav");
  const router = useRouter();
  const { call } = useApiClient();
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const commands = [
    { label: nav("dashboard"), href: "/app" },
    ...([
      ["library", "bibliotheque"], ["deliveries", "livraisons"], ["devices", "appareils"],
      ["sources", "sources"], ["access", "gateways"], ["settings", "reglages"],
    ] as const).map(([key, path]) => ({ label: nav(key), href: `/app/${path}` })),
    { label: t("addBooks"), href: "/app/bibliotheque?mode=sources&action=import" },
    { label: t("newDevice"), href: "/app/appareils?action=new" },
    { label: t("createGateway"), href: "/app/gateways?action=new" },
    { label: t("regenerate"), href: "/app/gateways?action=regenerate" },
  ].filter(command => command.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const entries = [...commands, ...books.map(book => ({ label: `${book.title} — ${book.author}`, href: `/app/bibliotheque?mode=mine&book=${encodeURIComponent(book.id)}` }))];
  const selectedIndex = Math.min(active, Math.max(0, entries.length - 1));

  useEffect(() => {
    if (!query.trim()) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const result = await call<PaginatedLibraryItems>(`/api/v1/books?page=1&limit=8&q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!controller.signal.aborted) { setBooks(result.items); setFailed(false); }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, call, attempt]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex]);

  function choose(index: number) {
    const entry = entries[index];
    if (!entry) return;
    close();
    router.push(entry.href);
  }
  return <>
    <Input autoFocus role="combobox" aria-label={t("search")} aria-autocomplete="list" aria-expanded="true" aria-controls={listId}
      aria-activedescendant={entries.length ? `${listId}-${selectedIndex}` : undefined}
      placeholder={t("search")} value={query}
      onChange={event => { setQuery(event.target.value); setBooks([]); setLoading(Boolean(event.target.value.trim())); setFailed(false); setActive(0); }}
      onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (entries.length) setActive((selectedIndex + (event.key === "ArrowDown" ? 1 : -1) + entries.length) % entries.length);
        } else if (event.key === "Home") { event.preventDefault(); setActive(0); }
        else if (event.key === "End") { event.preventDefault(); setActive(Math.max(0, entries.length - 1)); }
        else if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); choose(selectedIndex); }
      }} />
    {loading ? <p role="status">{t("loading")}</p> : null}
    {failed ? <div role="alert" className="space-y-2"><p>{t("failed")}</p><Button variant="outline" onClick={() => { setFailed(false); setLoading(true); setAttempt(value => value + 1); }}>{t("retry")}</Button></div> : null}
    {!loading && !failed && !entries.length ? <p role="status">{t("empty")}</p> : null}
    <ul ref={listRef} id={listId} role="listbox" aria-label={t("results")} className="max-h-80 min-w-0 overflow-y-auto">
      {entries.map((entry, index) => <li key={entry.href} id={`${listId}-${index}`} role="option" aria-selected={selectedIndex === index}
        className={cn("cursor-pointer rounded-md p-3 text-sm break-words", selectedIndex === index && "bg-accent text-accent-foreground")}
        onMouseDown={event => event.preventDefault()} onMouseMove={() => setActive(index)} onClick={() => choose(index)}>{entry.label}</li>)}
    </ul>
  </>;
}

export function CommandPalette() {
  const t = useTranslations("enhance.commands");
  const [open, setOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const inputFocus = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!open) returnFocus.current = document.activeElement as HTMLElement;
        setOpen(value => !value);
      }
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [open]);
  return <Dialog modal open={open} onOpenChange={value => { if (value) returnFocus.current = document.activeElement as HTMLElement; setOpen(value); }}>
    <DialogTrigger render={<Button variant="outline" size="sm" className="ml-auto min-w-0" />} aria-label={t("open")}>
      <Search /><span className="hidden sm:inline">{t("open")}</span><kbd className="text-xs">⌘/Ctrl K</kbd>
    </DialogTrigger>
    <DialogContent ref={inputFocus} aria-modal="true" className="max-h-[85dvh] overflow-y-auto motion-reduce:animate-none sm:max-w-lg"
      initialFocus={() => inputFocus.current?.querySelector("input") ?? null} finalFocus={returnFocus}>
      <DialogHeader><DialogTitle>{t("title")}</DialogTitle><DialogDescription>{t("description")}</DialogDescription></DialogHeader>
      {open ? <Commands close={() => setOpen(false)} /> : null}
    </DialogContent>
  </Dialog>;
}
