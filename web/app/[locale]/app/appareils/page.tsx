import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { DevicesView } from "@/components/app/devices/devices-view";
import { safeApiFetch } from "@/lib/api";
import type { Device } from "@/lib/types";

export default async function AppareilsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.devices");
  const devices = await safeApiFetch<Device[]>("/api/v1/devices");

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <DevicesView initialDevices={devices ?? []} devicesUnavailable={devices === null} />
    </div>
  );
}
