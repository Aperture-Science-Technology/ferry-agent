import { auth } from "@clerk/nextjs/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { safeApiFetch } from "@/lib/api";
import type { Device, DeliveryJob, Gateway, PaginatedLibraryItems } from "@/lib/types";
import { Onboarding } from "@/components/app/onboarding";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function AppIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");
  const home = await getTranslations("enhance.home");
  const { userId } = await auth();
  // Only presence is needed: don't load the collection or delivery history.
  const [books, devices, deliveries, gateways] = await Promise.all([
    safeApiFetch<PaginatedLibraryItems>("/api/v1/books?page=1&limit=1"),
    safeApiFetch<Device[]>("/api/v1/devices"),
    safeApiFetch<DeliveryJob[]>("/api/v1/deliveries?page=1&limit=1"),
    safeApiFetch<Gateway[]>("/api/v1/gateways"),
  ]);
  return <>
    <Onboarding userKey={userId ?? "anonymous"} status={{
      books: books === null ? null : books.total > 0,
      devices: devices === null ? null : devices.length > 0,
      deliveries: deliveries === null ? null : deliveries.length > 0,
      gateways: gateways === null ? null : gateways.length > 0,
    }} />
    <p className="text-muted-foreground">{home("description")}</p>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {([
        ["library", "bibliotheque"], ["deliveries", "livraisons"], ["devices", "appareils"],
        ["sources", "sources"], ["access", "gateways"], ["settings", "reglages"],
      ] as const).map(([key, path]) => <Link key={key} href={`/app/${path}`} className="min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-ring">
        <Card className="h-full"><CardHeader><CardTitle>{t(key)}</CardTitle><CardDescription>{home(key)}</CardDescription></CardHeader></Card>
      </Link>)}
    </div>
  </>;
}
