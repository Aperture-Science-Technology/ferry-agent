import { getTranslations, setRequestLocale } from "next-intl/server";
import { LibraryView } from "@/components/app/library/library-view";
import { mergeLibraryFetch } from "@/components/app/library/library-collection";
import { safeApiFetch } from "@/lib/api";
import type { Device, LibraryItem, PaginatedLibraryItems } from "@/lib/types";

async function fetchAllLibraryItems(): Promise<{
  items: LibraryItem[];
  unavailable: boolean;
  partial: boolean;
}> {
  const first = await safeApiFetch<PaginatedLibraryItems>("/api/v1/books?page=1&limit=200");
  if (first === null) {
    return mergeLibraryFetch<LibraryItem>(null, []);
  }

  const totalPages = Math.max(1, Math.ceil(first.total / Math.max(1, first.limit)));
  const rest: Array<PaginatedLibraryItems | null> = [];
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await safeApiFetch<PaginatedLibraryItems>(
      `/api/v1/books?page=${page}&limit=200`
    );
    rest.push(next);
    if (next === null) break;
  }

  return mergeLibraryFetch(first, rest);
}

export default async function BibliothequePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.library");

  const [library, devices] = await Promise.all([
    fetchAllLibraryItems(),
    safeApiFetch<Device[]>("/api/v1/devices"),
  ]);

  return (
    <LibraryView
      key={[
        library.unavailable ? "u" : "a",
        library.partial ? "p" : "c",
        library.items.length,
        library.items[0]?.id ?? "empty",
        library.items[library.items.length - 1]?.id ?? "empty",
      ].join(":")}
      title={t("title")}
      description={t("description")}
      initialItems={library.items}
      itemsUnavailable={library.unavailable}
      itemsPartial={library.partial}
      devices={devices ?? []}
    />
  );
}
