"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Radio, Plus, Ban, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/status-dot";
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
import { CreateGatewayDialog } from "@/components/app/gateways/create-gateway-dialog";
import { useApiClient } from "@/lib/api-client";
import type { Gateway } from "@/lib/types";

export function GatewaysView({
  initialGateways,
  gatewaysUnavailable,
}: {
  initialGateways: Gateway[];
  gatewaysUnavailable: boolean;
}) {
  const t = useTranslations("access");
  const tCommon = useTranslations("common");
  const { call } = useApiClient();
  const [gateways, setGateways] = useState(initialGateways);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Gateway | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function revoke(gateway: Gateway) {
    setRevokingId(gateway.gateway_id);
    try {
      await call(`/api/v1/gateways/revoke`, {
        method: "POST",
        body: JSON.stringify({ gateway_id: gateway.gateway_id }),
      });
      setGateways((prev) =>
        prev.map((g) =>
          g.gateway_id === gateway.gateway_id ? { ...g, status: "revoked" } : g
        )
      );
      toast.success(t("toastRevoked"));
    } catch {
      toast.error(t("toastRevokeFailed"));
    } finally {
      setRevokingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await call(`/api/v1/gateways/${deleteTarget.gateway_id}`, { method: "DELETE" });
      setGateways((prev) => prev.filter((g) => g.gateway_id !== deleteTarget.gateway_id));
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
          {t("createLink")}
        </Button>
      </div>

      {gateways.length === 0 ? (
        <EmptyState
          icon={Radio}
          title={t("emptyTitle")}
          description={gatewaysUnavailable ? t("emptyUnavailable") : t("emptyDescription")}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colName")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead>{t("colLastSeen")}</TableHead>
                <TableHead className="text-right">{t("colAction")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gateways.map((gateway) => (
                <TableRow key={gateway.gateway_id}>
                  <TableCell className="font-medium">{gateway.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusDot online={gateway.status === "paired"} />
                      <Badge variant="secondary" className="capitalize">
                        {gateway.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {gateway.last_seen_at
                      ? new Date(gateway.last_seen_at).toLocaleString()
                      : tCommon("never")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {gateway.status === "paired" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={revokingId === gateway.gateway_id}
                          onClick={() => revoke(gateway)}
                        >
                          <Ban />
                          {t("revoke")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteTarget(gateway)}
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

      <CreateGatewayDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(gateway) => setGateways((prev) => [gateway, ...prev])}
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
