import { PageHeader } from "@/components/app/page-header";
import { GatewaysView } from "@/components/app/gateways/gateways-view";
import { safeApiFetch } from "@/lib/api";
import type { Gateway } from "@/lib/types";

export default async function GatewaysPage() {
  const gateways = await safeApiFetch<Gateway[]>("/api/v1/gateways");

  return (
    <div>
      <PageHeader
        title="Gateways"
        description="Vos bundles détachés, pairés depuis votre propre réseau."
      />
      <GatewaysView
        initialGateways={gateways ?? []}
        gatewaysUnavailable={gateways === null}
      />
    </div>
  );
}
