"use client";

import { useState } from "react";
import { Tablet, Plus, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/app/empty-state";
import { NewDeviceDialog } from "@/components/app/devices/new-device-dialog";
import { CloudLinkDialog } from "@/components/app/devices/cloud-link-dialog";
import type { Device } from "@/lib/types";

const TIER_LABEL: Record<Device["delivery_tier"], string> = {
  A: "Email (Send-to-Kindle)",
  B: "Cloud (Dropbox/Drive)",
  C: "Code navigateur",
  D: "USB",
};

export function DevicesView({
  initialDevices,
  devicesUnavailable,
}: {
  initialDevices: Device[];
  devicesUnavailable: boolean;
}) {
  const [devices, setDevices] = useState(initialDevices);
  const [createOpen, setCreateOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<Device | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Nouvel appareil
        </Button>
      </div>

      {devices.length === 0 ? (
        <EmptyState
          icon={Tablet}
          title="Aucun appareil"
          description={
            devicesUnavailable
              ? "Le core est injoignable ou ne renvoie pas encore la liste des appareils."
              : "Ajoutez votre première liseuse pour commencer à recevoir des livres."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Appareil</TableHead>
                <TableHead>Tier de livraison</TableHead>
                <TableHead>Compte cloud</TableHead>
                <TableHead>Dernière synchro</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium capitalize">
                    {device.brand}
                    {device.model && (
                      <span className="text-muted-foreground"> — {device.model}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TIER_LABEL[device.delivery_tier]}</Badge>
                  </TableCell>
                  <TableCell>
                    {device.link_ref ? (
                      <Badge variant="outline" className="gap-1">
                        <Check className="size-3" /> Lié
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {device.last_synced_at
                      ? new Date(device.last_synced_at).toLocaleString()
                      : "Jamais"}
                  </TableCell>
                  <TableCell className="text-right">
                    {device.delivery_tier === "B" && (
                      <Button size="sm" variant="outline" onClick={() => setLinkTarget(device)}>
                        <Link2 />
                        Lier un compte cloud
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <NewDeviceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(device) => setDevices((prev) => [device, ...prev])}
      />
      <CloudLinkDialog
        device={linkTarget}
        onOpenChange={(open) => !open && setLinkTarget(null)}
        onLinked={(device) =>
          setDevices((prev) => prev.map((d) => (d.id === device.id ? device : d)))
        }
      />
    </div>
  );
}
