"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
        toast.error("Impossible de charger le suivi de cette livraison.");
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, call]);

  // The dialog is hidden whenever jobId is null (see `open` below), so we
  // only need to make sure stale data from a previous job isn't shown while
  // the next one is loading.
  const displayJob = job?.id === jobId ? job : null;
  const loading = jobId !== null && displayJob === null && failedId !== jobId;

  return (
    <Dialog open={jobId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suivi de la livraison</DialogTitle>
          <DialogDescription>{jobId}</DialogDescription>
        </DialogHeader>
        {loading || !displayJob ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Statut</span>
              <Badge className="capitalize">{displayJob.status}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Méthode</span>
              <span className="capitalize">{displayJob.method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Créée</span>
              <span>{new Date(displayJob.created_at).toLocaleString()}</span>
            </div>
            {displayJob.delivered_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Livrée</span>
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
