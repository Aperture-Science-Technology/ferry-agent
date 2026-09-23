import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
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
    <div className="min-w-0">
      <PageHeader title={t("title")} description={t("description")} />
      <GatewaysView
        initialGateways={gateways ?? []}
        gatewaysUnavailable={gateways === null}
      />
    </div>
  );
}
