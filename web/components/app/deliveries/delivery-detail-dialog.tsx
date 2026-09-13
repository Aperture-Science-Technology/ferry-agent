"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/app/state-panel";
import { useApiClient } from "@/lib/api-client";
import type { DeliveryJob, DeliveryStatus } from "@/lib/types";

const STATUS_VARIANT: Record<
  DeliveryStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  queued: "secondary",
  sent: "outline",
  delivered: "default",
  failed: "destructive",
};

export function DeliveryDetailDialog({
  jobId,
  onOpenChange,
}: {
  jobId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("deliveryDetail");
  const tDeliveries = useTranslations("deliveries");
  const tMethods = useTranslations("deliverDialog");
  const tCommon = useTranslations("common");
  const { call } = useApiClient();
  const [job, setJob] = useState<DeliveryJob | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setFailedId(null);
      return;
    }
    let cancelled = false;
    setFailedId(null);
    call<DeliveryJob>(`/api/v1/deliveries/${jobId}`)
      .then((result) => {
        if (cancelled) return;
        setJob(result);
      })
      .catch(() => {
        if (cancelled) return;
        setJob(null);
        setFailedId(jobId);
        toast.error(t("toastLoadFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, call, t]);

  const displayJob = job?.id === jobId ? job : null;
  const loadFailed = jobId !== null && failedId === jobId;
  const loading = jobId !== null && displayJob === null && !loadFailed;

  return (
    <Dialog open={jobId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 h-px w-14 bg-gradient-to-r from-chart-1 via-chart-2 to-transparent" />
          <DialogTitle className="font-heading text-xl tracking-tight">
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <StatePanel className="py-8">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-chart-1" />
              {t("loading")}
            </div>
            <div className="mt-4 w-full space-y-2">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-3/4 rounded-lg" />
            </div>
          </StatePanel>
        ) : loadFailed || !displayJob ? (
          <StatePanel
            className="py-10"
            title={t("loadErrorTitle")}
            description={t("loadErrorDescription")}
          />
        ) : (
          <div className="space-y-5 text-sm">
            <div className="min-w-0 space-y-1">
              <p className="font-heading text-base font-medium tracking-tight">
                <span className="line-clamp-2">
                  {displayJob.item_title ?? tCommon("dash")}
                </span>
              </p>
              <p className="line-clamp-1 text-muted-foreground">
                {displayJob.item_author ?? tCommon("dash")}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Badge variant={STATUS_VARIANT[displayJob.status]}>
                {tDeliveries(`statuses.${displayJob.status}`)}
              </Badge>
              {displayJob.target_format ? (
                <Badge variant="secondary" className="uppercase">
                  {displayJob.target_format}
                </Badge>
              ) : null}
            </div>

            <dl className="grid grid-cols-[minmax(0,8rem)_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">{t("device")}</dt>
              <dd className="min-w-0 truncate text-right sm:text-left">
                {displayJob.device_label ?? tCommon("dash")}
              </dd>

              <dt className="text-muted-foreground">{t("method")}</dt>
              <dd className="min-w-0 truncate text-right sm:text-left">
                {tMethods(`methods.${displayJob.method}`)}
              </dd>

              <dt className="text-muted-foreground">{t("format")}</dt>
              <dd className="text-right uppercase sm:text-left">
                {displayJob.target_format ?? tCommon("dash")}
              </dd>

              <dt className="text-muted-foreground">{t("created")}</dt>
              <dd className="text-right sm:text-left">
                {new Date(displayJob.created_at).toLocaleString()}
              </dd>

              {displayJob.delivered_at ? (
                <>
                  <dt className="text-muted-foreground">{t("delivered")}</dt>
                  <dd className="text-right sm:text-left">
                    {new Date(displayJob.delivered_at).toLocaleString()}
                  </dd>
                </>
              ) : null}
            </dl>

            {displayJob.error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                <p className="mb-1 font-heading text-xs font-medium tracking-tight text-destructive">
                  {t("error")}
                </p>
                <p className="break-words text-destructive">{displayJob.error}</p>
              </div>
            ) : null}

            {displayJob.download_url ? (
              <div className="space-y-2 border-t border-border/50 pt-4">
                <Button
                  size="sm"
                  render={
                    <a
                      href={displayJob.download_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download />
                      {t("download")}
                    </a>
                  }
                />
                <p className="truncate text-xs text-muted-foreground" title={displayJob.download_url}>
                  {displayJob.download_url}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
