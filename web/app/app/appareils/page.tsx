import { PageHeader } from "@/components/app/page-header";
import { DevicesView } from "@/components/app/devices/devices-view";
import { safeApiFetch } from "@/lib/api";
import type { Device } from "@/lib/types";

export default async function AppareilsPage() {
  const devices = await safeApiFetch<Device[]>("/api/v1/devices");

  return (
    <div>
      <PageHeader
        title="Appareils"
        description="Vos liseuses et leur route de livraison (email, cloud, code navigateur, USB)."
      />
      <DevicesView initialDevices={devices ?? []} devicesUnavailable={devices === null} />
    </div>
  );
}
