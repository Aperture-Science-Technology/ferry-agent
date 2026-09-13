"use client";

import { useState } from "react";
import { Download, Eye, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeliveryDetailDialog } from "@/components/app/deliveries/delivery-detail-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { SectionHeader } from "@/components/app/section-header";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import type { DeliveryJob, DeliveryMethod, DeliveryStatus } from "@/lib/types";

const STATUS_VARIANT: Record<
  DeliveryStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  queued: "secondary",
  sent: "outline",
  delivered: "default",
  failed: "destructive",
};

function DeliveryActions({
  job,
  onTrack,
  trackLabel,
  downloadLabel,
}: {
  job: DeliveryJob;
  onTrack: () => void;
  trackLabel: string;
  downloadLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {job.download_url ? (
        <Button
          size="sm"
          render={
            <a
              href={job.download_url}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              <Download />
              {downloadLabel}
            </a>
          }
        />
      ) : null}
      <Button
        size="sm"
        variant="outline"
        onClick={(event) => {
          event.stopPropagation();
          onTrack();
        }}
      >
        <Eye />
        {trackLabel}
      </Button>
    </div>
  );
}

function DeliveryMetaBadges({
  job,
  statusLabel,
  methodLabel,
}: {
  job: DeliveryJob;
  statusLabel: string;
  methodLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={STATUS_VARIANT[job.status]}>{statusLabel}</Badge>
      {job.target_format ? (
        <Badge variant="secondary" className="uppercase">
          {job.target_format}
        </Badge>
      ) : null}
      <Badge variant="outline" className="max-w-40 truncate">
        {methodLabel}
      </Badge>
    </div>
  );
}

export function DeliveriesView({
  initialDeliveries,
  deliveriesUnavailable,
}: {
  initialDeliveries: DeliveryJob[];
  deliveriesUnavailable: boolean;
}) {
  const t = useTranslations("deliveries");
  const tMethods = useTranslations("deliverDialog");
  const tCommon = useTranslations("common");
  const [deliveries] = useState(initialDeliveries);
  const [detailId, setDetailId] = useState<string | null>(null);

  function methodLabel(method: DeliveryMethod) {
    return tMethods(`methods.${method}`);
  }

  function statusLabel(status: DeliveryStatus) {
    return t(`statuses.${status}`);
  }

  return (
    <div className="space-y-6">
      <Reveal>
        <SectionHeader
          title={t("sectionTitle")}
          description={
            deliveries.length > 0 ? t("countLabel", { count: deliveries.length }) : undefined
          }
        />

        {deliveriesUnavailable && deliveries.length === 0 ? (
          <Alert>
            <Send />
            <AlertTitle>{t("emptyTitle")}</AlertTitle>
            <AlertDescription>{t("emptyUnavailable")}</AlertDescription>
          </Alert>
        ) : deliveries.length === 0 ? (
          <EmptyState
            icon={Send}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        ) : (
          <>
            {/* Mobile / narrow: cards */}
            <RevealGroup className="grid gap-3 md:hidden">
              {deliveries.map((job) => (
                <RevealItem key={job.id}>
                  <Card
                    size="sm"
                    className="cursor-pointer bg-card/60"
                    onClick={() => setDetailId(job.id)}
                  >
                    <CardContent className="space-y-3">
                      <div className="min-w-0">
                        <CardTitle className="line-clamp-2 text-sm">
                          {job.item_title ?? tCommon("dash")}
                        </CardTitle>
                        <CardDescription className="line-clamp-1">
                          {job.item_author ?? tCommon("dash")}
                        </CardDescription>
                      </div>

                      <DeliveryMetaBadges
                        job={job}
                        statusLabel={statusLabel(job.status)}
                        methodLabel={methodLabel(job.method)}
                      />

                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p className="truncate">
                          {job.device_label ?? tCommon("dash")}
                        </p>
                        <p className="text-xs">
                          {new Date(job.created_at).toLocaleString()}
                        </p>
                      </div>

                      {job.status === "failed" && job.error ? (
                        <p className="line-clamp-2 text-xs text-destructive">{job.error}</p>
                      ) : null}

                      <DeliveryActions
                        job={job}
                        onTrack={() => setDetailId(job.id)}
                        trackLabel={t("track")}
                        downloadLabel={t("openDownload")}
                      />
                    </CardContent>
                  </Card>
                </RevealItem>
              ))}
            </RevealGroup>

            {/* Desktop: table */}
            <Reveal className="hidden overflow-hidden rounded-xl border border-border/60 md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("colBook")}</TableHead>
                    <TableHead>{t("colDevice")}</TableHead>
                    <TableHead>{t("colMethod")}</TableHead>
                    <TableHead>{t("colFormat")}</TableHead>
                    <TableHead>{t("colStatus")}</TableHead>
                    <TableHead>{t("colCreated")}</TableHead>
                    <TableHead className="text-right">{t("colAction")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((job) => (
                    <TableRow
                      key={job.id}
                      className="cursor-pointer"
                      onClick={() => setDetailId(job.id)}
                    >
                      <TableCell className="font-medium">
                        <div className="min-w-0">
                          <span className="line-clamp-2">
                            {job.item_title ?? tCommon("dash")}
                          </span>
                          {job.item_author ? (
                            <div className="line-clamp-1 text-xs font-normal text-muted-foreground">
                              {job.item_author}
                            </div>
                          ) : null}
                          {job.status === "failed" && job.error ? (
                            <div className="mt-1 line-clamp-1 text-xs font-normal text-destructive">
                              {job.error}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-36 truncate text-muted-foreground">
                        {job.device_label ?? tCommon("dash")}
                      </TableCell>
                      <TableCell>
                        <span className="line-clamp-1 text-sm">
                          {methodLabel(job.method)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {job.target_format ? (
                          <Badge variant="secondary" className="uppercase">
                            {job.target_format}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">{tCommon("dash")}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[job.status]}>
                          {statusLabel(job.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(job.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DeliveryActions
                          job={job}
                          onTrack={() => setDetailId(job.id)}
                          trackLabel={t("track")}
                          downloadLabel={t("openDownload")}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Reveal>
          </>
        )}
      </Reveal>

      <DeliveryDetailDialog
        jobId={detailId}
        onOpenChange={(open) => !open && setDetailId(null)}
      />
    </div>
  );
}
