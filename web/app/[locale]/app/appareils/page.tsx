import { getTranslations, setRequestLocale } from "next-intl/server";
import { DevicesView } from "@/components/app/devices/devices-view";
import { safeApiFetch } from "@/lib/api";
import type { Device } from "@/lib/types";

export default async function AppareilsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cloud_link?: string }>;
}) {
  const { locale } = await params;
  const { cloud_link: cloudLinkRaw } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("pages.devices");
  const devices = await safeApiFetch<Device[]>("/api/v1/devices");
  const cloudLinkStatus =
    cloudLinkRaw === "ok" || cloudLinkRaw === "error" ? cloudLinkRaw : undefined;

  return (
    <DevicesView
      title={t("title")}
      description={t("description")}
      initialDevices={devices ?? []}
      devicesUnavailable={devices === null}
      cloudLinkStatus={cloudLinkStatus}
    />
  );
}
