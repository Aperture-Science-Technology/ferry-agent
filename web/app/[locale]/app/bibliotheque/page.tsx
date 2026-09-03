import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { LibraryView } from "@/components/app/library/library-view";
import { safeApiFetch } from "@/lib/api";
import type { Device, LibraryItem } from "@/lib/types";

export default async function BibliothequePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.library");

  const [items, devices] = await Promise.all([
    safeApiFetch<LibraryItem[]>("/api/v1/books"),
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
