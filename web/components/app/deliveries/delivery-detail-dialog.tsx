"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
import {
  isActiveDeliveryStatus,
  mergeDeliveryJobs,
  normalizeDeliveryStatus,
} from "@/components/app/deliveries/deliveries-state";
import { StatePanel } from "@/components/app/state-panel";
import { useApiClient } from "@/lib/api-client";
import type { DeliveryJob, DeliveryStatus } from "@/lib/types";

const DETAIL_POLL_MS = 5000;
const DETAIL_POLL_MAX_MS = 5 * 60 * 1000;

const STATUS_VARIANT: Record<
  DeliveryStatus | "unknown",
  "default" | "secondary" | "destructive" | "outline"
> = {
  queued: "secondary",
  sent: "outline",
  delivered: "default",
  failed: "destructive",
  unknown: "outline",
};

function formatAppDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function DeliveryDetailDialog({
  jobId,
  seedJob,
  onOpenChange,
  onJobUpdated,
}: {
  jobId: string | null;
  seedJob?: DeliveryJob | null;
  onOpenChange: (open: boolean) => void;
  onJobUpdated?: (job: DeliveryJob) => void;
}) {
  const t = useTranslations("deliveryDetail");
  const tDeliveries = useTranslations("deliveries");
  const tMethods = useTranslations("deliverDialog");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { call } = useApiClient();
  const [fetchedJob, setFetchedJob] = useState<DeliveryJob | null>(null);
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const pollStartedAt = useRef<number | null>(null);

  const displayJob = useMemo(() => {
    if (!jobId) return null;
    const seed = seedJob?.id === jobId ? seedJob : null;
    const fetched = fetchedJob?.id === jobId ? fetchedJob : null;
    if (fetched && seed) return mergeDeliveryJobs([seed], [fetched])[0]!;
    return fetched ?? seed;
  }, [jobId, seedJob, fetchedJob]);

  const loadFailed = Boolean(jobId) && failed && !displayJob;
  const loading = Boolean(jobId) && displayJob === null && !loadFailed;

  const notifyUpdated = useCallback(
    (job: DeliveryJob) => {
      onJobUpdated?.(job);
    },
    [onJobUpdated]
  );

  useEffect(() => {
    if (!jobId) {
      setFetchedJob(null);
      setFailed(false);
      return;
    }
    let cancelled = false;
    void call<DeliveryJob>(`/api/v1/deliveries/${jobId}`)
      .then((result) => {
        if (cancelled) return;
        setFetchedJob(result);
        setFailed(false);
        notifyUpdated(result);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        toast.error(t("toastLoadFailed"));
      });
    return () => {
      cancelled = true;
    };
    // Parent may pass a new onJobUpdated each render; load only on id/retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notifyUpdated intentionally omitted
  }, [jobId, call, t, retryToken]);

  useEffect(() => {
    if (!jobId || !displayJob) return;
    if (!isActiveDeliveryStatus(displayJob.status)) {
      pollStartedAt.current = null;
      return;
    }
    if (pollStartedAt.current === null) {
      pollStartedAt.current = Date.now();
    }
    const id = window.setInterval(() => {
      if (
        pollStartedAt.current !== null &&
        Date.now() - pollStartedAt.current > DETAIL_POLL_MAX_MS
      ) {
        return;
      }
      void call<DeliveryJob>(`/api/v1/deliveries/${jobId}`)
        .then((result) => {
          setFetchedJob(result);
          setFailed(false);
          notifyUpdated(result);
        })
        .catch(() => {
          /* keep last known detail during silent poll failure */
        });
    }, DETAIL_POLL_MS);
    return () => window.clearInterval(id);
  }, [jobId, displayJob, call, notifyUpdated]);

  async function handleRetry() {
    if (!jobId) return;
    setRetrying(true);
    setFailed(false);
    setRetryToken((value) => value + 1);
    setRetrying(false);
  }

  function statusLabel(status: string) {
    const normalized = normalizeDeliveryStatus(status);
    if (normalized === "unknown") return tDeliveries("statuses.unknown");
    return tDeliveries(`statuses.${normalized}`);
  }

  return (
    <Dialog open={jobId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl tracking-tight">
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <StatePanel className="py-8">
            <div
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
              aria-busy="true"
            >
              <Loader2 className="size-4 animate-spin text-chart-1 motion-reduce:animate-none" />
              {t("loading")}
            </div>
            <div className="mt-4 w-full space-y-2">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-3/4 rounded-lg" />
            </div>
          </StatePanel>
        ) : loadFailed ? (
          <StatePanel
            className="py-10"
            title={t("loadErrorTitle")}
            description={t("loadErrorDescription")}
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleRetry()}
                disabled={retrying}
              >
                {retrying ? <Loader2 className="animate-spin" /> : null}
                {t("retry")}
              </Button>
            }
          />
        ) : displayJob ? (
          <div className="space-y-5 text-sm">
            <div className="min-w-0 space-y-1">
              <p className="font-heading text-base font-medium tracking-tight">
                <span className="line-clamp-3 break-words">
                  {displayJob.item_title ?? tCommon("dash")}
                </span>
              </p>
              <p className="line-clamp-2 text-muted-foreground break-words">
                {displayJob.item_author ?? tCommon("dash")}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <Badge
                  variant={
                    STATUS_VARIANT[normalizeDeliveryStatus(displayJob.status)]
                  }
                >
                  {statusLabel(displayJob.status)}
                </Badge>
                {displayJob.target_format ? (
                  <Badge variant="secondary" className="uppercase">
                    {displayJob.target_format}
                  </Badge>
                ) : null}
              </div>
              {normalizeDeliveryStatus(displayJob.status) === "delivered" ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("statusHintDelivered")}
                </p>
              ) : normalizeDeliveryStatus(displayJob.status) === "queued" ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("statusHintQueued")}
                </p>
              ) : normalizeDeliveryStatus(displayJob.status) === "sent" ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("statusHintSent")}
                </p>
              ) : normalizeDeliveryStatus(displayJob.status) === "unknown" ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("statusHintUnknown")}
                </p>
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
                {formatAppDate(displayJob.created_at, locale)}
              </dd>

              {displayJob.delivered_at ? (
                <>
                  <dt className="text-muted-foreground">{t("delivered")}</dt>
                  <dd className="text-right sm:text-left">
                    {formatAppDate(displayJob.delivered_at, locale)}
                  </dd>
                </>
              ) : null}
            </dl>

            {displayJob.status === "failed" ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                <p className="mb-1 font-heading text-xs font-medium tracking-tight text-destructive">
                  {t("error")}
                </p>
                <p className="break-words text-destructive">
                  {displayJob.error?.trim()
                    ? displayJob.error
                    : t("errorFallback")}
                </p>
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
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={displayJob.download_url}
                >
                  {displayJob.download_url}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
