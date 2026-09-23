import { getTranslations, setRequestLocale } from "next-intl/server";
import { DeliveriesView } from "@/components/app/deliveries/deliveries-view";
import { safeApiFetch } from "@/lib/api";
import type { DeliveryJob } from "@/lib/types";

export default async function LivraisonsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.deliveries");
  const deliveries = await safeApiFetch<DeliveryJob[]>("/api/v1/deliveries");

  return (
    <DeliveriesView
      title={t("title")}
      description={t("description")}
      initialDeliveries={deliveries ?? []}
      deliveriesUnavailable={deliveries === null}
    />
  );
}
