"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CircleAlert, Download, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
import {
  DeliveryEmpty,
  DeliveryFeedback,
} from "@/components/app/deliveries/delivery-feedback";
import { DeliveryStatusBadge } from "@/components/app/deliveries/delivery-status-badge";
import { useApiClient } from "@/lib/api-client";
import type { DeliveryJob } from "@/lib/types";

const DETAIL_POLL_MS = 5000;
const DETAIL_POLL_MAX_MS = 5 * 60 * 1000;

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
      // Reset the previous request state when the dialog closes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const normalizedStatus = displayJob
    ? normalizeDeliveryStatus(displayJob.status)
    : null;

  return (
    <Dialog open={jobId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,40rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl tracking-tight text-balance">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="leading-relaxed whitespace-normal">
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col gap-3 py-6" aria-busy="true">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-chart-1 motion-reduce:animate-none" />
              {t("loading")}
            </div>
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-3/4 rounded-md" />
          </div>
        ) : loadFailed ? (
          <DeliveryEmpty
            icon={CircleAlert}
            title={t("loadErrorTitle")}
            description={t("loadErrorDescription")}
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleRetry()}
                disabled={retrying}
                className="whitespace-normal rounded-md"
              >
                {retrying ? <Loader2 className="animate-spin" /> : null}
                {t("retry")}
              </Button>
            }
          />
        ) : displayJob ? (
          <div className="min-w-0 space-y-5 text-sm">
            <div className="min-w-0 space-y-1">
              <p className="font-heading text-base font-medium tracking-tight">
                <span className="line-clamp-3 break-words whitespace-normal">
                  {tDeliveries("routeTo", {
                    title: displayJob.item_title ?? tCommon("dash"),
                    device: displayJob.device_label ?? tCommon("dash"),
                  })}
                </span>
              </p>
              <p className="line-clamp-2 break-words whitespace-normal text-muted-foreground">
                {displayJob.item_author ?? tCommon("dash")}
              </p>
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <DeliveryStatusBadge
                  status={displayJob.status}
                  label={statusLabel(displayJob.status)}
                />
                {displayJob.target_format ? (
                  <span className="text-xs tracking-wide text-muted-foreground uppercase">
                    {displayJob.target_format}
                  </span>
                ) : null}
              </div>
              {normalizedStatus === "delivered" ? (
                <p className="text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
                  {t("statusHintDelivered")}
                </p>
              ) : normalizedStatus === "queued" ? (
                <p className="text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
                  {t("statusHintQueued")}
                </p>
              ) : normalizedStatus === "sent" ? (
                <p className="text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
                  {t("statusHintSent")}
                </p>
              ) : normalizedStatus === "unknown" ? (
                <p className="text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
                  {t("statusHintUnknown")}
                </p>
              ) : null}
            </div>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,8rem)_1fr] sm:gap-x-4 sm:gap-y-2">
              <div className="min-w-0 sm:contents">
                <dt className="text-muted-foreground">{t("device")}</dt>
                <dd className="min-w-0 break-words whitespace-normal sm:text-left">
                  {displayJob.device_label ?? tCommon("dash")}
                </dd>
              </div>

              <div className="min-w-0 sm:contents">
                <dt className="text-muted-foreground">{t("method")}</dt>
                <dd className="min-w-0 break-words whitespace-normal sm:text-left">
                  {tMethods(`methods.${displayJob.method}`)}
                </dd>
              </div>

              <div className="min-w-0 sm:contents">
                <dt className="text-muted-foreground">{t("format")}</dt>
                <dd className="break-words whitespace-normal uppercase sm:text-left">
                  {displayJob.target_format ?? tCommon("dash")}
                </dd>
              </div>

              <div className="min-w-0 sm:contents">
                <dt className="text-muted-foreground">{t("created")}</dt>
                <dd className="break-words whitespace-normal sm:text-left">
                  {formatAppDate(displayJob.created_at, locale)}
                </dd>
              </div>

              {displayJob.delivered_at ? (
                <div className="min-w-0 sm:contents">
                  <dt className="text-muted-foreground">{t("delivered")}</dt>
                  <dd className="break-words whitespace-normal sm:text-left">
                    {formatAppDate(displayJob.delivered_at, locale)}
                  </dd>
                </div>
              ) : null}
            </dl>

            {displayJob.status === "failed" ? (
              <DeliveryFeedback
                role="alert"
                title={t("error")}
                description={
                  displayJob.error?.trim()
                    ? displayJob.error
                    : t("errorFallback")
                }
                className="border-destructive/30 bg-destructive/10"
              />
            ) : null}

            {displayJob.download_url ? (
              <div className="min-w-0 space-y-2 border-t border-border pt-4">
                <Button
                  size="sm"
                  className="whitespace-normal rounded-md"
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
                  className="break-all text-xs leading-relaxed text-muted-foreground"
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
