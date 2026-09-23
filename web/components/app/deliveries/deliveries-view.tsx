"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, Loader2, RefreshCw, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  applyDeliveryFetchResult,
  hasActiveDeliveries,
  mergeDeliveryJobs,
  normalizeDeliveryStatus,
} from "@/components/app/deliveries/deliveries-state";
import { DeliveryDetailDialog } from "@/components/app/deliveries/delivery-detail-dialog";
import { DeliveryStatusBadge } from "@/components/app/deliveries/delivery-status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { SectionHeader } from "@/components/app/section-header";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { useApiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
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
  align = "end",
  emphasizeTrack = false,
}: {
  job: DeliveryJob;
  onTrack: () => void;
  trackLabel: string;
  downloadLabel: string;
  trackAria: string;
  align?: "start" | "end";
  emphasizeTrack?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-2",
        align === "start" ? "justify-start" : "justify-end"
      )}
    >
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

function DeliveryMetaLine({
  method,
  format,
  date,
}: {
  method: string;
  format: string | null;
  date: string;
}) {
  return (
    <p className="text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
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
    <div className="space-y-6">
      <Reveal>
        <SectionHeader
          title={t("sectionTitle")}
          description={
            deliveries.length > 0
              ? t("countLabel", { count: deliveries.length })
              : t("sectionDescription")
          }
          action={refreshAction}
        />

        {refreshError && deliveries.length > 0 ? (
          <div
            role="status"
            className="mb-4 flex flex-col gap-3 border border-border/80 bg-accent/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
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
          <div aria-busy={refreshing}>
            <RevealGroup className="grid gap-0 divide-y divide-border/70 lg:hidden">
              {deliveries.map((job) => {
                const normalized = normalizeDeliveryStatus(job.status);
                const failed = normalized === "failed";
                return (
                  <RevealItem key={job.id}>
                    <article className="flex min-w-0 flex-col gap-3 py-4 first:pt-0 last:pb-0">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <h3 className="font-heading text-[15px] leading-snug font-medium tracking-tight break-words whitespace-normal">
                            {routeTitle(job)}
                          </h3>
                          {job.item_author ? (
                            <p className="line-clamp-2 text-sm break-words whitespace-normal text-muted-foreground">
                              {job.item_author}
                            </p>
                          ) : null}
                          <DeliveryMetaLine
                            method={methodLabel(job.method)}
                            format={job.target_format ?? null}
                            date={formatAppDate(job.created_at, locale)}
                          />
                        </div>
                        <div className="max-w-[40%] min-w-0 shrink">
                          <DeliveryStatusBadge
                            status={job.status}
                            label={statusLabel(job.status)}
                          />
                        </div>
                      </div>

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

                      <DeliveryActions
                        job={job}
                        align="start"
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
                    </article>
                  </RevealItem>
                );
              })}
            </RevealGroup>

            <Reveal className="hidden overflow-x-auto border-y border-border/70 lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("colBook")}</TableHead>
                    <TableHead>{t("colDevice")}</TableHead>
                    <TableHead className="hidden xl:table-cell">
                      {t("colMethod")}
                    </TableHead>
                    <TableHead className="hidden xl:table-cell">
                      {t("colFormat")}
                    </TableHead>
                    <TableHead>{t("colStatus")}</TableHead>
                    <TableHead>{t("colCreated")}</TableHead>
                    <TableHead className="text-right">{t("colAction")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((job) => {
                    const normalized = normalizeDeliveryStatus(job.status);
                    const failed = normalized === "failed";
                    return (
                      <TableRow key={job.id} className="hover:bg-muted/20">
                        <TableCell className="max-w-56 align-top font-medium whitespace-normal">
                          <div className="min-w-0 space-y-1">
                            <span className="font-heading line-clamp-2 text-sm font-medium tracking-tight break-words whitespace-normal">
                              {job.item_title ?? tCommon("dash")}
                            </span>
                            {job.item_author ? (
                              <div className="line-clamp-2 text-xs font-normal break-words whitespace-normal text-muted-foreground">
                                {job.item_author}
                              </div>
                            ) : null}
                            {failed ? (
                              <div className="line-clamp-2 text-xs font-normal break-words whitespace-normal text-destructive">
                                {t("failedHint")}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-40 align-top text-sm whitespace-normal text-muted-foreground">
                          <span className="line-clamp-2 break-words whitespace-normal">
                            {job.device_label ?? tCommon("dash")}
                          </span>
                        </TableCell>
                        <TableCell className="hidden align-top whitespace-normal xl:table-cell">
                          <span className="line-clamp-2 text-sm break-words whitespace-normal text-muted-foreground">
                            {methodLabel(job.method)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden align-top whitespace-normal xl:table-cell">
                          {job.target_format ? (
                            <span className="text-xs tracking-wide text-muted-foreground uppercase">
                              {job.target_format}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {tCommon("dash")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="align-top whitespace-normal">
                          <div className="min-w-0 space-y-1">
                            <DeliveryStatusBadge
                              status={job.status}
                              label={statusLabel(job.status)}
                            />
                            {normalized === "delivered" ? (
                              <p className="max-w-44 text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
                                {t("statusHintDeliveredShort")}
                              </p>
                            ) : null}
                            {normalized === "unknown" ? (
                              <p className="max-w-44 text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
                                {t("statusHintUnknown")}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-sm whitespace-normal text-muted-foreground">
                          <span className="break-words">
                            {formatAppDate(job.created_at, locale)}
                          </span>
                        </TableCell>
                        <TableCell className="align-top whitespace-normal text-right">
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Reveal>
          </div>
        )}
      </Reveal>

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
