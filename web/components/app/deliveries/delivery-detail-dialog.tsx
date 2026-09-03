"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApiClient } from "@/lib/api-client";
import type { DeliveryJob } from "@/lib/types";

export function DeliveryDetailDialog({
  jobId,
  onOpenChange,
}: {
  jobId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("deliveryDetail");
  const tDeliveries = useTranslations("deliveries");
  const { call } = useApiClient();
  const [job, setJob] = useState<DeliveryJob | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    call<DeliveryJob>(`/api/v1/deliveries/${jobId}`)
      .then((result) => {
        if (cancelled) return;
        setJob(result);
      })
      .catch(() => {
        if (cancelled) return;
        setFailedId(jobId);
        toast.error(t("toastLoadFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, call, t]);

  const displayJob = job?.id === jobId ? job : null;
  const loading = jobId !== null && displayJob === null && failedId !== jobId;

  return (
    <Dialog open={jobId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{jobId}</DialogDescription>
        </DialogHeader>
        {loading || !displayJob ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("status")}</span>
              <Badge>{tDeliveries(`statuses.${displayJob.status}`)}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("method")}</span>
              <span className="capitalize">{displayJob.method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("created")}</span>
              <span>{new Date(displayJob.created_at).toLocaleString()}</span>
            </div>
            {displayJob.delivered_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("delivered")}</span>
                <span>{new Date(displayJob.delivered_at).toLocaleString()}</span>
              </div>
            )}
            {displayJob.error && (
              <div className="rounded-md bg-destructive/10 p-3 text-destructive">
                {displayJob.error}
              </div>
            )}
            {displayJob.download_url && (
              <a
                href={displayJob.download_url}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-primary underline"
              >
                {displayJob.download_url}
              </a>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
