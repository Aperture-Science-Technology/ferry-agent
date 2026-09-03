import { PageHeader } from "@/components/app/page-header";
import { LibraryView } from "@/components/app/library/library-view";
import { safeApiFetch } from "@/lib/api";
import type { Device, LibraryItem } from "@/lib/types";

export default async function BibliothequePage() {
  const [items, devices] = await Promise.all([
    safeApiFetch<LibraryItem[]>("/api/v1/books"),
    safeApiFetch<Device[]>("/api/v1/devices"),
  ]);

  return (
    <div>
      <PageHeader
        title="Bibliothèque"
        description="Vos livres, ajoutés depuis une source légale, un gateway pairé ou un upload."
      />
      <LibraryView
        initialItems={items ?? []}
        itemsUnavailable={items === null}
        devices={devices ?? []}
      />
    </div>
  );
}
