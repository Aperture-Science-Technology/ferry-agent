"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Radio, Plus, Ban } from "lucide-react";
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
  const { call } = useApiClient();
  const [gateways, setGateways] = useState(initialGateways);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

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
      toast.success("Gateway révoqué.");
    } catch {
      toast.error("Impossible de révoquer ce gateway.");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Créer / relier
        </Button>
      </div>

      {gateways.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="Aucun gateway"
          description={
            gatewaysUnavailable
              ? "Le core est injoignable."
              : "Créez un gateway pour pairer un bundle détaché sur votre propre réseau."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Dernière activité</TableHead>
                <TableHead className="text-right">Action</TableHead>
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
                      : "Jamais"}
                  </TableCell>
                  <TableCell className="text-right">
                    {gateway.status !== "revoked" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={revokingId === gateway.gateway_id}
                        onClick={() => revoke(gateway)}
                      >
                        <Ban />
                        Révoquer
                      </Button>
                    )}
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
    </div>
  );
}
