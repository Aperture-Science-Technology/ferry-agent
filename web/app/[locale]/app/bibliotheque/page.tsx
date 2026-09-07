import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { LibraryView } from "@/components/app/library/library-view";
import { safeApiFetch } from "@/lib/api";
import type { Device, LibraryItem, PaginatedLibraryItems } from "@/lib/types";

async function fetchAllLibraryItems(): Promise<LibraryItem[] | null> {
  const first = await safeApiFetch<PaginatedLibraryItems>("/api/v1/books?page=1&limit=200");
  if (first === null) return null;
  const items = [...first.items];
  const totalPages = Math.max(1, Math.ceil(first.total / first.limit));
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await safeApiFetch<PaginatedLibraryItems>(
      `/api/v1/books?page=${page}&limit=200`
    );
    if (next === null) break;
    items.push(...next.items);
  }
  return items;
}

export default async function BibliothequePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.library");

  const [items, devices] = await Promise.all([
    fetchAllLibraryItems(),
    safeApiFetch<Device[]>("/api/v1/devices"),
  ]);

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <LibraryView
        initialItems={items ?? []}
        itemsUnavailable={items === null}
        devices={devices ?? []}
      />
    </div>
  );
}
