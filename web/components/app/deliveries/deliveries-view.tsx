"use client";

import { useState } from "react";
import { Send, Eye } from "lucide-react";
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
import { DeliveryDetailDialog } from "@/components/app/deliveries/delivery-detail-dialog";
import type { DeliveryJob, DeliveryStatus } from "@/lib/types";

const STATUS_VARIANT: Record<DeliveryStatus, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "secondary",
  sent: "outline",
  delivered: "default",
  failed: "destructive",
};

export function DeliveriesView({
  initialDeliveries,
  deliveriesUnavailable,
}: {
  initialDeliveries: DeliveryJob[];
  deliveriesUnavailable: boolean;
}) {
  const [deliveries] = useState(initialDeliveries);
  const [detailId, setDetailId] = useState<string | null>(null);

  if (deliveries.length === 0) {
    return (
      <EmptyState
        icon={Send}
        title="Aucune livraison"
        description={
          deliveriesUnavailable
            ? "Le core est injoignable."
            : "Livrez un livre depuis votre bibliothèque pour voir son suivi ici."
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Statut</TableHead>
            <TableHead>Méthode</TableHead>
            <TableHead>Créée</TableHead>
            <TableHead>Livrée</TableHead>
            <TableHead>Erreur</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deliveries.map((job) => (
            <TableRow key={job.id}>
              <TableCell>
                <Badge variant={STATUS_VARIANT[job.status]} className="capitalize">
                  {job.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground capitalize">{job.method}</TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(job.created_at).toLocaleString()}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {job.delivered_at ? new Date(job.delivered_at).toLocaleString() : "—"}
              </TableCell>
              <TableCell className="max-w-48 truncate text-destructive">{job.error ?? "—"}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => setDetailId(job.id)}>
                  <Eye />
                  Suivre
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <DeliveryDetailDialog jobId={detailId} onOpenChange={(open) => !open && setDetailId(null)} />
    </div>
  );
}
