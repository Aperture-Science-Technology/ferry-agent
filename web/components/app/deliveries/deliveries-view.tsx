"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Download, Eye, Loader2, RefreshCw, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  applyDeliveryFetchResult,
  hasActiveDeliveries,
  mergeDeliveryJobs,
  normalizeDeliveryStatus,
} from "@/components/app/deliveries/deliveries-state";
import { DeliveryDetailDialog } from "@/components/app/deliveries/delivery-detail-dialog";
import { DeliveryStatusBadge } from "@/components/app/deliveries/delivery-status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { useApiClient } from "@/lib/api-client";
import type { DeliveryJob, DeliveryMethod } from "@/lib/types";

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_MS = 5 * 60 * 1000;

function formatAppDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function DeliveryActions({
  job,
  onTrack,
  trackLabel,
  downloadLabel,
  trackAria,
  emphasizeTrack = false,
}: {
  job: DeliveryJob;
  onTrack: () => void;
  trackLabel: string;
  downloadLabel: string;
  trackAria: string;
  emphasizeTrack?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {job.download_url ? (
        <Button
          size="sm"
          variant="outline"
          className="min-w-0 whitespace-normal"
          render={
            <a href={job.download_url} target="_blank" rel="noreferrer">
              <Download />
              {downloadLabel}
            </a>
          }
        />
      ) : null}
      <Button
        size="sm"
        variant={emphasizeTrack ? "default" : "outline"}
        className="min-w-0 whitespace-normal"
        aria-label={trackAria || undefined}
        onClick={onTrack}
      >
        <Eye />
        {trackLabel}
      </Button>
    </div>
  );
}

/** Pen StatusRow secondary line: method · format · date (12/500 muted). */
function DeliveryWhenLine({
  method,
  format,
  date,
}: {
  method: string;
  format: string | null;
  date: string;
}) {
  return (
    <p className="text-xs font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
      <span>{method}</span>
      {format ? (
        <>
          <span className="mx-1.5 text-border" aria-hidden>
            ·
          </span>
          <span className="uppercase tracking-wide">{format}</span>
        </>
      ) : null}
      <span className="mx-1.5 text-border" aria-hidden>
        ·
      </span>
      <span>{date}</span>
    </p>
  );
}

function DeliveryStatusRow({
  job,
  routeTitle,
  methodLabel,
  statusLabel,
  dateLabel,
  hints,
  actions,
}: {
  job: DeliveryJob;
  routeTitle: string;
  methodLabel: string;
  statusLabel: string;
  dateLabel: string;
  hints: ReactNode;
  actions: ReactNode;
}) {
  return (
    <article
      data-testid="delivery-status-row"
      className="flex min-w-0 flex-col gap-3 border-b border-border py-3 last:border-b-0"
    >
      {/* Pen Delivery/StatusRow mtEug — meta + badge, gap 16, pad 12 0 */}
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-base font-medium break-words whitespace-normal text-foreground">
            {routeTitle}
          </h2>
          <DeliveryWhenLine
            method={methodLabel}
            format={job.target_format ?? null}
            date={dateLabel}
          />
          {hints}
        </div>
        <DeliveryStatusBadge
          status={job.status}
          label={statusLabel}
          className="shrink-0"
        />
      </div>
      {actions}
    </article>
  );
}

export function DeliveriesView({
  title,
  description,
  initialDeliveries,
  deliveriesUnavailable,
}: {
  title: string;
  description: string;
  initialDeliveries: DeliveryJob[];
  deliveriesUnavailable: boolean;
}) {
  const t = useTranslations("deliveries");
  const tBrand = useTranslations("brand");
  const tMethods = useTranslations("deliverDialog");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { call } = useApiClient();

  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [unavailable, setUnavailable] = useState(
    deliveriesUnavailable && initialDeliveries.length === 0
  );
  const [refreshError, setRefreshError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const pollStartedAt = useRef<number | null>(null);
  const refreshingRef = useRef(false);

  function methodLabel(method: DeliveryMethod) {
    return tMethods(`methods.${method}`);
  }

  function statusLabel(status: string) {
    const normalized = normalizeDeliveryStatus(status);
    if (normalized === "unknown") return t("statuses.unknown");
    return t(`statuses.${normalized}`);
  }

  function routeTitle(job: DeliveryJob) {
    return t("routeTo", {
      title: job.item_title ?? tCommon("dash"),
      device: job.device_label ?? tCommon("dash"),
    });
  }

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      if (!opts?.silent) setRefreshing(true);
      try {
        const fresh = await call<DeliveryJob[]>("/api/v1/deliveries");
        let outcomeOk = true;
        let nextItems: DeliveryJob[] = [];
        setDeliveries((prev) => {
          const outcome = applyDeliveryFetchResult(prev, fresh);
          outcomeOk = outcome.ok;
          nextItems = outcome.items;
          return outcome.items;
        });
        setUnavailable(false);
        setRefreshError(!outcomeOk);
        if (outcomeOk && !hasActiveDeliveries(nextItems)) {
          pollStartedAt.current = null;
        }
      } catch {
        let keptEmpty = true;
        setDeliveries((prev) => {
          const outcome = applyDeliveryFetchResult(prev, null);
          keptEmpty = outcome.items.length === 0;
          return outcome.items;
        });
        if (keptEmpty) {
          setUnavailable(true);
        } else {
          setRefreshError(true);
        }
      } finally {
        refreshingRef.current = false;
        setRefreshing(false);
      }
    },
    [call]
  );

  useEffect(() => {
    if (!hasActiveDeliveries(deliveries)) {
      pollStartedAt.current = null;
      return;
    }
    if (pollStartedAt.current === null) {
      pollStartedAt.current = Date.now();
    }
    const id = window.setInterval(() => {
      if (
        pollStartedAt.current !== null &&
        Date.now() - pollStartedAt.current > POLL_MAX_MS
      ) {
        return;
      }
      void refresh({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [deliveries, refresh]);

  const seedJob = useMemo(
    () =>
      detailId !== null
        ? (deliveries.find((job) => job.id === detailId) ?? null)
        : null,
    [detailId, deliveries]
  );

  const refreshAction = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void refresh()}
      disabled={refreshing}
      aria-busy={refreshing}
      className="whitespace-normal"
    >
      {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {t("refresh")}
    </Button>
  );

  const retryButton = (
    <Button
      size="sm"
      variant="outline"
      onClick={() => void refresh()}
      disabled={refreshing}
      className="w-fit shrink-0 whitespace-normal"
    >
      {refreshing ? <Loader2 className="animate-spin" /> : null}
      {t("retry")}
    </Button>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="deliveries-pen-layout">
      {/* Pen Header/PageTitle Hd0003 (28/14 desktop) + mobile Top mF0035 (brand/22/12) */}
      <header className="flex min-h-[72px] flex-col justify-center gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="font-heading text-sm font-medium text-muted-foreground md:hidden">
            {tBrand("name")}
          </p>
          <h1 className="font-heading text-[22px] font-medium text-foreground md:text-[28px]">
            {title}
          </h1>
          <p className="text-xs font-medium text-muted-foreground md:text-sm">
            {description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">{refreshAction}</div>
      </header>

      {refreshError && deliveries.length > 0 ? (
        <div
          role="status"
          className="flex flex-col gap-3 border border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 space-y-1">
            <p className="font-heading text-sm font-medium tracking-tight">
              {t("refreshFailedTitle")}
            </p>
            <p className="text-sm leading-relaxed whitespace-normal text-muted-foreground">
              {t("refreshFailedDescription")}
            </p>
          </div>
          {retryButton}
        </div>
      ) : null}

      {unavailable && deliveries.length === 0 ? (
        <div role="alert">
          <EmptyState
            icon={Send}
            title={t("unavailableTitle")}
            description={t("emptyUnavailable")}
            action={retryButton}
          />
        </div>
      ) : deliveries.length === 0 ? (
        <EmptyState
          icon={Send}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <Reveal>
          <div aria-busy={refreshing} data-testid="deliveries-status-rows">
            <RevealGroup className="flex min-w-0 flex-col">
              {deliveries.map((job) => {
                const normalized = normalizeDeliveryStatus(job.status);
                const failed = normalized === "failed";
                return (
                  <RevealItem key={job.id}>
                    <DeliveryStatusRow
                      job={job}
                      routeTitle={routeTitle(job)}
                      methodLabel={methodLabel(job.method)}
                      statusLabel={statusLabel(job.status)}
                      dateLabel={formatAppDate(job.created_at, locale)}
                      hints={
                        <>
                          {normalized === "delivered" ? (
                            <p className="text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
                              {t("statusHintDelivered")}
                            </p>
                          ) : null}
                          {normalized === "unknown" ? (
                            <p className="text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
                              {t("statusHintUnknown")}
                            </p>
                          ) : null}
                          {failed ? (
                            <p className="text-xs leading-relaxed break-words whitespace-normal text-destructive">
                              {t("failedHint")}
                            </p>
                          ) : null}
                        </>
                      }
                      actions={
                        <DeliveryActions
                          job={job}
                          emphasizeTrack={failed}
                          onTrack={() => setDetailId(job.id)}
                          trackLabel={failed ? t("trackFailed") : t("track")}
                          downloadLabel={t("openDownload")}
                          trackAria={
                            failed
                              ? t("trackFailedAria", {
                                  title: job.item_title ?? tCommon("dash"),
                                })
                              : t("trackAria", {
                                  title: job.item_title ?? tCommon("dash"),
                                })
                          }
                        />
                      }
                    />
                  </RevealItem>
                );
              })}
            </RevealGroup>
          </div>
        </Reveal>
      )}

      <DeliveryDetailDialog
        key={detailId ?? "closed"}
        jobId={detailId}
        seedJob={seedJob}
        onOpenChange={(open) => !open && setDetailId(null)}
        onJobUpdated={(job) => {
          setDeliveries((prev) => {
            const exists = prev.some((row) => row.id === job.id);
            if (!exists) return [job, ...prev];
            return mergeDeliveryJobs(
              prev,
              prev.map((row) => (row.id === job.id ? job : row))
            );
          });
        }}
      />
    </div>
  );
}
