import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { CommandPalette } from "@/components/app/command-palette";
import { LibraryView } from "@/components/app/library/library-view";
import { DevicesView } from "@/components/app/devices/devices-view";
import { DeliveriesView } from "@/components/app/deliveries/deliveries-view";
import { Onboarding } from "@/components/app/onboarding";
import { StorageQuota } from "@/components/app/settings/storage-quota";
import { usePathname } from "./navigation";
import { books, devices, jobs } from "./api";
import fr from "@/messages/fr.json";
import en from "@/messages/en.json";
import "../../app/globals.css";

function Harness() {
  const pathname = usePathname();
  const params = new URLSearchParams(location.search);
  const empty = params.has("empty");
  const locale = params.get("locale") === "en" ? "en" : "fr";
  return <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center gap-2 px-4"><button>Origine</button><CommandPalette /></header>
      <main className="flex min-w-0 flex-col gap-6 px-8 py-6">
        {pathname.includes("appareils") ? <DevicesView title="Liseuses" description="Vos appareils" initialDevices={empty ? [] : devices} devicesUnavailable={false} />
          : pathname.includes("livraisons") ? <DeliveriesView title="Livraisons" description="Suivez vos livres" initialDeliveries={empty ? [] : jobs} initialDevices={devices} deliveriesUnavailable={false} />
          : pathname.includes("onboarding") ? <><Onboarding userKey="browser" status={{ books: true, devices: false, deliveries: false, gateways: null }} /><StorageQuota storage={{ used_bytes: 4.6 * 1024 ** 3, quota_bytes: 5 * 1024 ** 3, percentage: 92 }} /></>
          : <LibraryView key={pathname} title="Bibliothèque" description="Vos livres" initialItems={empty ? [] : books} itemsUnavailable={false} itemsPartial={false} devices={devices} />}
      </main>
    </div>
  </NextIntlClientProvider>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
