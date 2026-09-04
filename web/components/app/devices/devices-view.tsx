"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Tablet, Plus, Link2, Check, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/app/empty-state";
import { NewDeviceDialog } from "@/components/app/devices/new-device-dialog";
import { CloudLinkDialog } from "@/components/app/devices/cloud-link-dialog";
import { useApiClient } from "@/lib/api-client";
import type { Device } from "@/lib/types";

export function DevicesView({
  initialDevices,
  devicesUnavailable,
}: {
  initialDevices: Device[];
  devicesUnavailable: boolean;
}) {
  const t = useTranslations("devices");
  const tCommon = useTranslations("common");
  const { call } = useApiClient();
  const [devices, setDevices] = useState(initialDevices);
  const [createOpen, setCreateOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<Device | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await call(`/api/v1/devices/${deleteTarget.id}`, { method: "DELETE" });
      setDevices((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      toast.success(t("toastDeleted"));
      setDeleteTarget(null);
    } catch {
      toast.error(t("toastDeleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          {t("newDevice")}
        </Button>
      </div>

      {devices.length === 0 ? (
        <EmptyState
          icon={Tablet}
          title={t("emptyTitle")}
          description={devicesUnavailable ? t("emptyUnavailable") : t("emptyDescription")}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colDevice")}</TableHead>
                <TableHead>{t("colDelivery")}</TableHead>
                <TableHead>{t("colCloud")}</TableHead>
                <TableHead>{t("colLastSync")}</TableHead>
                <TableHead className="text-right">{t("colAction")}</TableHead>
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
                    <Badge variant="secondary">{t(`tiers.${device.delivery_tier}`)}</Badge>
                  </TableCell>
                  <TableCell>
                    {device.link_ref ? (
                      <Badge variant="outline" className="gap-1">
                        <Check className="size-3" /> {t("linked")}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">{tCommon("dash")}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {device.last_synced_at
                      ? new Date(device.last_synced_at).toLocaleString()
                      : tCommon("never")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {device.delivery_tier === "B" && (
                        <Button size="sm" variant="outline" onClick={() => setLinkTarget(device)}>
                          <Link2 />
                          {t("linkCloud")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteTarget(device)}
                      >
                        <Trash2 />
                        {t("delete")}
                      </Button>
                    </div>
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

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("deleteConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              <Trash2 />
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
