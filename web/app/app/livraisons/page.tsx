import { PageHeader } from "@/components/app/page-header";
import { DeliveriesView } from "@/components/app/deliveries/deliveries-view";
import { safeApiFetch } from "@/lib/api";
import type { DeliveryJob } from "@/lib/types";

export default async function LivraisonsPage() {
  const deliveries = await safeApiFetch<DeliveryJob[]>("/api/v1/deliveries");

  return (
    <div>
      <PageHeader
        title="Livraisons"
        description="Historique des envois vers vos appareils."
      />
      <DeliveriesView
        initialDeliveries={deliveries ?? []}
        deliveriesUnavailable={deliveries === null}
      />
    </div>
  );
}
