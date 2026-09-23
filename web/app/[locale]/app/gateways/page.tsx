import { getTranslations, setRequestLocale } from "next-intl/server";
import { GatewaysView } from "@/components/app/gateways/gateways-view";
import { safeApiFetch } from "@/lib/api";
import type { Gateway } from "@/lib/types";

export default async function GatewaysPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.access");
  const gateways = await safeApiFetch<Gateway[]>("/api/v1/gateways");

  return (
    <GatewaysView
      title={t("title")}
      description={t("description")}
      initialGateways={gateways ?? []}
      gatewaysUnavailable={gateways === null}
    />
  );
}
