"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  applyDeliveryFetchResult,
  hasActiveDeliveries,
  mergeDeliveryJobs,
  normalizeDeliveryStatus,
} from "@/components/app/deliveries/deliveries-state";
import { DeliveryDetailDialog } from "@/components/app/deliveries/delivery-detail-dialog";
import {
  DeliveryEmpty,
  DeliveryFeedback,
} from "@/components/app/deliveries/delivery-feedback";
import {
  DeliveryActions,
  DeliveryStatusRow,
} from "@/components/app/deliveries/delivery-status-row";
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
      className="whitespace-normal rounded-md"
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
      className="w-fit shrink-0 whitespace-normal rounded-md"
    >
      {refreshing ? <Loader2 className="animate-spin" /> : null}
      {t("retry")}
    </Button>
  );

  const rows = (
    <Reveal>
      <div aria-busy={refreshing} data-testid="deliveries-status-rows">
        <RevealGroup className="flex min-w-0 flex-col gap-3 md:gap-0">
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
  );

  const body =
    unavailable && deliveries.length === 0 ? (
      <DeliveryEmpty
        role="alert"
        icon={Send}
        title={t("unavailableTitle")}
        description={t("emptyUnavailable")}
        action={retryButton}
      />
    ) : deliveries.length === 0 ? (
      <DeliveryEmpty
        icon={Send}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    ) : (
      rows
    );

  return (
    <div
      className="flex min-w-0 flex-col gap-2 md:gap-6"
      data-testid="deliveries-pen-layout"
    >
      {/* Title stacks are dedicated (mF0035 vs Hd0003); refresh is shared once. */}
      <div className="flex flex-col gap-2 md:min-h-[72px] md:flex-row md:items-center md:justify-between md:gap-4">
        <header
          data-testid="deliveries-header-mobile"
          className="flex flex-col gap-2 md:hidden"
        >
          <p className="font-heading text-sm font-medium text-muted-foreground">
            {tBrand("name")}
          </p>
          <h1 className="font-heading text-[22px] font-medium text-foreground">
            {title}
          </h1>
          <p className="text-xs font-medium text-muted-foreground">
            {description}
          </p>
        </header>

        <header
          data-testid="deliveries-header-desktop"
          className="hidden min-w-0 flex-1 flex-col gap-2 md:flex"
        >
          <h1 className="font-heading text-[28px] font-medium text-foreground">
            {title}
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            {description}
          </p>
        </header>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {refreshAction}
        </div>
      </div>

      {refreshError && deliveries.length > 0 ? (
        <DeliveryFeedback
          role="status"
          title={t("refreshFailedTitle")}
          description={t("refreshFailedDescription")}
          action={retryButton}
          className="flex-col items-stretch sm:flex-row sm:items-center"
        />
      ) : null}

      {/* Pen Body — mobile gap 12 (mF0035); desktop Rows stack (SAPRI) */}
      <div data-testid="deliveries-body">{body}</div>

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
