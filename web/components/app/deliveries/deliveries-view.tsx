"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, Loader2, RefreshCw, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
import {
  applyDeliveryFetchResult,
  hasActiveDeliveries,
  mergeDeliveryJobs,
  normalizeDeliveryStatus,
} from "@/components/app/deliveries/deliveries-state";
import { DeliveryDetailDialog } from "@/components/app/deliveries/delivery-detail-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { SectionHeader } from "@/components/app/section-header";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { useApiClient } from "@/lib/api-client";
import type { DeliveryJob, DeliveryMethod, DeliveryStatus } from "@/lib/types";

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_MS = 5 * 60 * 1000;

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

function DeliveryActions({
  job,
  onTrack,
  trackLabel,
  downloadLabel,
  trackAria,
  align = "end",
}: {
  job: DeliveryJob;
  onTrack: () => void;
  trackLabel: string;
  downloadLabel: string;
  trackAria: string;
  align?: "start" | "end";
}) {
  return (
    <div
      className={
        align === "start"
          ? "flex flex-wrap items-center justify-start gap-2"
          : "flex flex-wrap items-center justify-end gap-2"
      }
    >
      {job.download_url ? (
        <Button
          size="sm"
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
        variant="outline"
        aria-label={trackAria}
        onClick={onTrack}
      >
        <Eye />
        {trackLabel}
      </Button>
    </div>
  );
}

function DeliveryStatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  const normalized = normalizeDeliveryStatus(status);
  return <Badge variant={STATUS_VARIANT[normalized]}>{label}</Badge>;
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
    >
      {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {t("refresh")}
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
          <Alert className="mb-4" role="status">
            <AlertTitle>{t("refreshFailedTitle")}</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{t("refreshFailedDescription")}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refresh()}
                disabled={refreshing}
              >
                {refreshing ? <Loader2 className="animate-spin" /> : null}
                {t("retry")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {unavailable && deliveries.length === 0 ? (
          <Alert role="alert">
            <Send />
            <AlertTitle>{t("unavailableTitle")}</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{t("emptyUnavailable")}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refresh()}
                disabled={refreshing}
              >
                {refreshing ? <Loader2 className="animate-spin" /> : null}
                {t("retry")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : deliveries.length === 0 ? (
          <EmptyState
            icon={Send}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        ) : (
          <div aria-busy={refreshing}>
            <RevealGroup className="grid gap-3 lg:hidden">
              {deliveries.map((job) => (
                <RevealItem key={job.id}>
                  <Card size="sm" className="bg-card/60">
                    <CardContent className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <CardTitle className="font-heading line-clamp-2 text-sm font-medium tracking-tight break-words">
                            {job.item_title ?? tCommon("dash")}
                          </CardTitle>
                          <CardDescription className="line-clamp-2 break-words">
                            {job.item_author ?? tCommon("dash")}
                          </CardDescription>
                          <p className="line-clamp-2 text-sm text-muted-foreground break-words">
                            {job.device_label ?? tCommon("dash")}
                          </p>
                        </div>
                        <div className="shrink-0">
                          <DeliveryStatusBadge
                            status={job.status}
                            label={statusLabel(job.status)}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {job.target_format ? (
                          <Badge variant="secondary" className="uppercase">
                            {job.target_format}
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="max-w-full truncate">
                          {methodLabel(job.method)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatAppDate(job.created_at, locale)}
                        </span>
                      </div>

                      {normalizeDeliveryStatus(job.status) === "delivered" ? (
                        <p className="text-xs leading-relaxed text-muted-foreground break-words">
                          {t("statusHintDelivered")}
                        </p>
                      ) : null}

                      {job.status === "failed" ? (
                        <p className="line-clamp-2 text-xs leading-relaxed text-destructive break-words">
                          {t("failedHint")}
                        </p>
                      ) : null}

                      <DeliveryActions
                        job={job}
                        align="start"
                        onTrack={() => setDetailId(job.id)}
                        trackLabel={t("track")}
                        downloadLabel={t("openDownload")}
                        trackAria={t("trackAria", {
                          title: job.item_title ?? tCommon("dash"),
                        })}
                      />
                    </CardContent>
                  </Card>
                </RevealItem>
              ))}
            </RevealGroup>

            <Reveal className="hidden overflow-hidden rounded-xl border border-border/60 lg:block">
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
                    <TableRow key={job.id}>
                      <TableCell className="align-middle font-medium">
                        <div className="min-w-0 space-y-1">
                          <span className="font-heading line-clamp-2 text-sm font-medium tracking-tight break-words whitespace-normal">
                            {job.item_title ?? tCommon("dash")}
                          </span>
                          {job.item_author ? (
                            <div className="line-clamp-2 text-xs font-normal text-muted-foreground break-words whitespace-normal">
                              {job.item_author}
                            </div>
                          ) : null}
                          {job.status === "failed" ? (
                            <div className="line-clamp-2 text-xs font-normal text-destructive break-words whitespace-normal">
                              {t("failedHint")}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-40 align-middle text-sm text-muted-foreground">
                        <span className="line-clamp-2 break-words whitespace-normal">
                          {job.device_label ?? tCommon("dash")}
                        </span>
                      </TableCell>
                      <TableCell className="align-middle">
                        <span className="line-clamp-2 text-sm text-muted-foreground break-words whitespace-normal">
                          {methodLabel(job.method)}
                        </span>
                      </TableCell>
                      <TableCell className="align-middle">
                        {job.target_format ? (
                          <Badge variant="secondary" className="uppercase">
                            {job.target_format}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">
                            {tCommon("dash")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="space-y-1">
                          <DeliveryStatusBadge
                            status={job.status}
                            label={statusLabel(job.status)}
                          />
                          {normalizeDeliveryStatus(job.status) ===
                          "delivered" ? (
                            <p className="max-w-40 text-xs leading-relaxed text-muted-foreground break-words whitespace-normal">
                              {t("statusHintDeliveredShort")}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-middle whitespace-nowrap text-muted-foreground">
                        {formatAppDate(job.created_at, locale)}
                      </TableCell>
                      <TableCell className="align-middle text-right">
                        <DeliveryActions
                          job={job}
                          onTrack={() => setDetailId(job.id)}
                          trackLabel={t("track")}
                          downloadLabel={t("openDownload")}
                          trackAria={t("trackAria", {
                            title: job.item_title ?? tCommon("dash"),
                          })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
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
