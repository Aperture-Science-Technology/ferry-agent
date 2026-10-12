"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, Send, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  applyDeliveryFetchResult,
  hasActiveDeliveries,
  isActiveDeliveryStatus,
  deliveryStatusLabelKey,
  mergeDeliveryJobs,
  normalizeDeliveryStatus,
} from "@/components/app/deliveries/deliveries-state";
import { DeliveryDetailDialog } from "@/components/app/deliveries/delivery-detail-dialog";
import {
  DeliveryEmpty,
  DeliveryFeedback,
  DeliveryFeedbackPartial,
} from "@/components/app/deliveries/delivery-feedback";
import {
  DeliveryActions,
  DeliveryStatusRow,
} from "@/components/app/deliveries/delivery-status-row";
import { PageHeader } from "@/components/app/page-header";
import { Reveal } from "@/components/motion/reveal";
import { useApiClient } from "@/lib/api-client";
import type { Device, DeliveryJob, DeliveryMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_MS = 5 * 60 * 1000;

type DeliveryFilter = "all" | "delivered" | "in_progress" | "sent" | "failed";

function formatRelativeWhen(
  iso: string,
  locale: string,
  labels: {
    today: (time: string) => string;
    yesterday: (time: string) => string;
    other: (date: string, time: string) => string;
  }
) {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfDay.getTime()) / 86_400_000
  );

  if (dayDiff === 0) return labels.today(time);
  if (dayDiff === 1) return labels.yesterday(time);

  const datePart = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
  }).format(date);
  return labels.other(datePart, time);
}

function matchesFilter(job: DeliveryJob, filter: DeliveryFilter): boolean {
  const normalized = normalizeDeliveryStatus(job.status);
  switch (filter) {
    case "all":
      return true;
    case "delivered":
      return normalized === "delivered";
    case "failed":
      return normalized === "failed";
    case "in_progress":
      return normalized === "queued";
    case "sent":
      return normalized === "sent";
    default:
      return true;
  }
}

export function DeliveriesView({
  title,
  description,
  initialDeliveries,
  initialDevices = [],
  deliveriesUnavailable,
}: {
  title: string;
  description: string;
  initialDeliveries: DeliveryJob[];
  initialDevices?: Device[];
  deliveriesUnavailable: boolean;
}) {
  const t = useTranslations("deliveries");
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
  const [filter, setFilter] = useState<DeliveryFilter>("all");

  const [query, setQuery] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const devices = initialDevices;
  const [page, setPage] = useState(1);
  const [acting, setActing] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const requestNumber = useRef(0);
  const params = new URLSearchParams({ page: String(page), limit: "50" });
  if (query) params.set("q", query);
  if (deviceId) params.set("device_id", deviceId);
  if (filter !== "all") params.set("status", filter === "in_progress" ? "queued" : filter);
  const endpoint = `/api/v1/deliveries?${params}`;
  const initialEndpoint = useRef(endpoint);


  async function act(job: DeliveryJob, action: "retry" | "cancel") {
    setActing(job.id); setActionError("");
    try {
      const result = await call<DeliveryJob>(`/api/v1/deliveries/${job.id}/${action}`, { method: "POST" });
      setDeliveries(previous => previous.map(row => row.id === job.id ? result : row));
    } catch { setActionError(t("actionError")); }
    finally { setActing(null); }
  }

  const pollStartedAt = useRef<number | null>(null);

  function methodLabel(method: DeliveryMethod) {
    return tMethods(`methods.${method}`);
  }

  function statusLabel(job: DeliveryJob) {
    return t(`statuses.${deliveryStatusLabelKey(job)}`);
  }

  function routeTitle(job: DeliveryJob) {
    return t("routeTo", {
      title: job.item_title ?? tCommon("dash"),
      device: job.device_label ?? tCommon("dash"),
    });
  }

  function dateLabel(iso: string) {
    return formatRelativeWhen(iso, locale, {
      today: (time) => t("relativeToday", { time }),
      yesterday: (time) => t("relativeYesterday", { time }),
      other: (date, time) => t("relativeOther", { date, time }),
    });
  }

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      const request = ++requestNumber.current;
      if (!opts?.silent) setRefreshing(true);
      try {
        const fresh = await call<DeliveryJob[]>(endpoint);
        if (request !== requestNumber.current) return;
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
        if (request !== requestNumber.current) return;
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
        if (request === requestNumber.current) setRefreshing(false);
      }
    },
    [call, endpoint]
  );

  useEffect(() => {
    if (initialEndpoint.current === endpoint) return;
    initialEndpoint.current = endpoint;
    const timer = window.setTimeout(() => { void refresh(); }, 250);
    return () => window.clearTimeout(timer);
  }, [endpoint, refresh]);

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

  const activeCount = useMemo(
    () => deliveries.filter((job) => isActiveDeliveryStatus(job)).length,
    [deliveries]
  );
  const failedCount = useMemo(
    () =>
      deliveries.filter(
        (job) => normalizeDeliveryStatus(job.status) === "failed"
      ).length,
    [deliveries]
  );

  const filteredDeliveries = useMemo(
    () => deliveries.filter((job) => matchesFilter(job, filter)),
    [deliveries, filter]
  );

  const queueSummary = useMemo(() => {
    if (activeCount > 0 && failedCount > 0) {
      return t("queueSummaryBoth", {
        active: activeCount,
        failed: failedCount,
      });
    }
    if (activeCount > 0) {
      return t("queueSummaryActive", { count: activeCount });
    }
    if (failedCount > 0) {
      return t("queueSummaryFailed", { count: failedCount });
    }
    return null;
  }, [activeCount, failedCount, t]);

  const filterLabel = (value: DeliveryFilter) => {
    switch (value) {
      case "all":
        return t("filterAll");
      case "delivered":
        return t("filterDelivered");
      case "in_progress":
        return t("filterQueued");
      case "sent":
        return t("filterSent");
      case "failed":
        return t("filterFailed");
    }
  };

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

  const filterChips = (
    <div
      className="flex flex-wrap items-center gap-2 pb-2"
      role="group"
      aria-label={t("filtersLabel")}
      data-testid="deliveries-filters"
    >
      {(
        [
          "all",
          "delivered",
          "in_progress",
          "sent",
          "failed",
        ] as const satisfies DeliveryFilter[]
      ).map((value) => (
        <button
          key={value}
          type="button"
          className={cn(
            buttonVariants({
              variant: filter === value ? "default" : "ghost",
            })
          )}
          aria-pressed={filter === value}
          onClick={() => { setPage(1); setFilter(value); }}
        >
          {filterLabel(value)}
        </button>
      ))}
      <span className="sr-only" aria-live="polite">
        {t("filterActiveAnnouncement", { filter: filterLabel(filter) })}
      </span>
    </div>
  );

  const rows = (
    <Reveal>
      <ul
        aria-busy={refreshing}
        aria-label={t("history")}
        data-testid="deliveries-status-rows"
        className="flex min-w-0 flex-col"
      >
        {filteredDeliveries.map((job) => {
          const normalized = normalizeDeliveryStatus(job.status);
          const failed = normalized === "failed";
          const titleText = routeTitle(job);
          return (
            <li key={job.id}>
              <DeliveryStatusRow
                job={job}
                routeTitle={titleText}
                methodLabel={methodLabel(job.method)}
                statusLabel={statusLabel(job)}
                dateLabel={dateLabel(job.created_at)}
                hints={
                  <>
                    {normalized === "sent" && job.method === "email" ? (
                      <p className="text-xs text-muted-foreground">{t("statusHintSentEmail")}</p>
                    ) : null}
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
                      <p className="text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
                        {t("failedHint")}
                      </p>
                    ) : null}
                  </>
                }
                actions={
                  <>
                  {job.status === "failed" || job.status === "queued" ? <Button variant="outline" size="sm" disabled={acting !== null} onClick={() => void act(job, job.status === "failed" ? "retry" : "cancel")}>{t(job.status === "failed" ? "retryDelivery" : "cancelDelivery")}</Button> : null}
                  <DeliveryActions
                    job={job}
                    onTrack={() => setDetailId(job.id)}
                    trackLabel={failed ? t("trackFailed") : t("track")}
                    downloadLabel={t(job.method === "opds" ? "openCatalog" : "openDownload")}
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
                  </>
                }
              />
            </li>
          );
        })}
      </ul>
    </Reveal>
  );

  const historyBody =
    deliveries.length === 0 ? (
      <DeliveryEmpty
        icon={Send}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    ) : filteredDeliveries.length === 0 ? (
      <DeliveryEmpty
        icon={Send}
        title={t("filterNoMatch")}
        description={t("filterNoMatchDescription")}
      />
    ) : (
      rows
    );

  return (
    <div
      className="flex min-w-0 flex-col gap-5"
      data-testid="deliveries-pen-layout"
    >
      <PageHeader
        title={title}
        description={description}
        action={refreshAction}
      />

      {refreshError && deliveries.length > 0 ? (
        <DeliveryFeedbackPartial
          title={t("refreshFailedTitle")}
          description={t("refreshFailedDescription")}
          ignoreLabel={tCommon("ignore")}
          onIgnore={() => setRefreshError(false)}
          refreshLabel={t("refresh")}
          onRefresh={() => void refresh()}
        />
      ) : null}

      {unavailable && deliveries.length === 0 ? (
        <DeliveryEmpty
          role="alert"
          icon={Send}
          title={t("unavailableTitle")}
          description={t("emptyUnavailable")}
          action={retryButton}
        />
      ) : (
        <>
          {queueSummary ? (
            <DeliveryFeedback
              icon={Truck}
              title={queueSummary}
              description={t("queueHintHelp")}
              data-testid="deliveries-queue-hint"
            />
          ) : null}

          <section
            data-testid="deliveries-panel"
            aria-label={t("history")}
            className="flex flex-col gap-1 rounded-lg border border-border-strong bg-ferry-surface px-5 py-2"
          >
            <div className="flex items-center justify-between py-3">
              <h2 className="text-base font-medium text-foreground">
                {t("history")}
              </h2>
              <p className="text-xs font-medium text-muted-foreground">
                {t("historyCount", { count: deliveries.length })}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 py-3">
              <Input aria-label={t("search")} placeholder={t("search")} value={query} onChange={event => { setPage(1); setQuery(event.target.value); }} />
              <select className="rounded-md border p-2" aria-label={t("deviceFilter")} value={deviceId} onChange={event => { setPage(1); setDeviceId(event.target.value); }}>
                <option value="">{t("allDevices")}</option>
                {devices.map(device => <option key={device.id} value={device.id}>{device.name || `${device.brand} ${device.model ?? ""}`}</option>)}
              </select>
            </div>
            {filterChips}
            {actionError ? <p role="alert">{actionError}</p> : null}

            <div data-testid="deliveries-body">{historyBody}</div>
            <nav aria-label={t("pagination")} className="flex items-center gap-3 py-3">
              <Button variant="outline" disabled={page === 1 || refreshing} onClick={() => setPage(value => value - 1)}>{t("previousPage")}</Button>
              <span>{t("pageNumber", { page })}</span>
              <Button variant="outline" disabled={deliveries.length < 50 || refreshing} onClick={() => setPage(value => value + 1)}>{t("nextPage")}</Button>
            </nav>
          </section>
        </>
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
