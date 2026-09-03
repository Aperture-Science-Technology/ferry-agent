"use client";

import { useState } from "react";
import { Send, Eye } from "lucide-react";
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
  const t = useTranslations("deliveries");
  const tCommon = useTranslations("common");
  const [deliveries] = useState(initialDeliveries);
  const [detailId, setDetailId] = useState<string | null>(null);

  if (deliveries.length === 0) {
    return (
      <EmptyState
        icon={Send}
        title={t("emptyTitle")}
        description={
          deliveriesUnavailable ? t("emptyUnavailable") : t("emptyDescription")
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colStatus")}</TableHead>
            <TableHead>{t("colMethod")}</TableHead>
            <TableHead>{t("colCreated")}</TableHead>
            <TableHead>{t("colDelivered")}</TableHead>
            <TableHead>{t("colError")}</TableHead>
            <TableHead className="text-right">{t("colAction")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deliveries.map((job) => (
            <TableRow key={job.id}>
              <TableCell>
                <Badge variant={STATUS_VARIANT[job.status]}>
                  {t(`statuses.${job.status}`)}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground capitalize">{job.method}</TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(job.created_at).toLocaleString()}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {job.delivered_at
                  ? new Date(job.delivered_at).toLocaleString()
                  : tCommon("dash")}
              </TableCell>
              <TableCell className="max-w-48 truncate text-destructive">
                {job.error ?? tCommon("dash")}
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => setDetailId(job.id)}>
                  <Eye />
                  {t("track")}
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
