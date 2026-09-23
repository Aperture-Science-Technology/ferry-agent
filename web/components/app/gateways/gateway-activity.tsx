"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { GatewayFeedback } from "@/components/app/gateways/gateway-feedback";
import {
  applyActivityFetchResult,
  normalizeJobStatus,
  type ActivityFetchOutcome,
} from "@/components/app/gateways/gateways-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { GatewayJobStatusOut, GatewayJobType } from "@/lib/types";

const MAX_ATTEMPTS_DISPLAY = 5;

type AccessTranslations = ReturnType<typeof useTranslations<"access">>;

function mapJobError(
  type: GatewayJobType,
  error: string | null | undefined,
  t: AccessTranslations
): string {
  if (error) {
    if (
      /abandonn[ée] après \d+ tentatives/i.test(error) ||
      /abandoned after \d+ attempts/i.test(error)
    ) {
      return t("jobFailedAbandoned");
    }
    if (/malveillant|VirusTotal/i.test(error)) return t("jobFailedMalicious");
    if (/volumineux|too large/i.test(error)) return t("jobFailedTooLarge");
    if (/livre reconnu|Formats acceptés|not a recognized/i.test(error)) {
      return t("jobFailedBadFormat");
    }
    if (/revoked/i.test(error)) return t("jobFailedRevoked");
  }
  return type === "search" ? t("jobFailedSearch") : t("jobFailedGeneric");
}

export function GatewayRecentActivity({
  gatewayId,
  refreshKey,
}: {
  gatewayId: string;
  refreshKey: number;
}) {
  return (
    <GatewayRecentActivityPanel
      key={`${gatewayId}:${refreshKey}`}
      gatewayId={gatewayId}
    />
  );
}

function GatewayRecentActivityPanel({ gatewayId }: { gatewayId: string }) {
  const t = useTranslations("access");
  const { call } = useApiClient();
  const [outcome, setOutcome] = useState<
    ActivityFetchOutcome<GatewayJobStatusOut> | "loading"
  >("loading");

  useEffect(() => {
    let cancelled = false;
    call<GatewayJobStatusOut[]>(`/api/v1/gateways/${gatewayId}/jobs?limit=20`)
      .then((data) => {
        if (!cancelled) setOutcome(applyActivityFetchResult(data));
      })
      .catch(() => {
        if (!cancelled) setOutcome(applyActivityFetchResult(null));
      });
    return () => {
      cancelled = true;
    };
  }, [gatewayId, call]);

  function typeLabel(type: GatewayJobType) {
    return type === "search" ? t("jobTypeSearch") : t("jobTypeFetch");
  }

  function statusLabel(status: string) {
    const bucket = normalizeJobStatus(status);
    if (bucket === "done") return t("jobStatusDone");
    if (bucket === "failed") return t("jobStatusFailed");
    if (bucket === "uncertain") return t("jobStatusUncertain");
    return t("jobStatusActive");
  }

  if (outcome === "loading") {
    return (
      <div
        className="flex flex-col gap-2 border-t border-border pt-3"
        aria-busy="true"
        data-activity="loading"
      >
        <p className="text-sm font-medium text-foreground">{t("recentActivity")}</p>
        <p className="text-sm text-muted-foreground">{t("activityLoading")}</p>
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    );
  }

  if (outcome.status === "unavailable") {
    return (
      <div
        className="flex flex-col gap-2 border-t border-border pt-3"
        data-activity="unavailable"
      >
        <p className="text-sm font-medium text-foreground">{t("recentActivity")}</p>
        <GatewayFeedback
          role="alert"
          title={t("activityUnavailableTitle")}
          description={t("activityUnavailable")}
          className="flex-col items-stretch sm:flex-row sm:items-center"
        />
      </div>
    );
  }

  if (outcome.status === "empty") {
    return (
      <div
        className="flex flex-col gap-2 border-t border-border pt-3"
        data-activity="empty"
      >
        <p className="text-sm font-medium text-foreground">{t("recentActivity")}</p>
        <p className="text-sm font-medium text-muted-foreground">
          {t("activityEmpty")}
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-2 border-t border-border pt-3"
      data-activity="ready"
    >
      <p className="text-sm font-medium text-foreground">{t("recentActivity")}</p>
      <ul className="flex flex-col gap-2">
        {outcome.jobs.map((job) => {
          const bucket = normalizeJobStatus(job.status);
          const inProgress = bucket === "active";
          return (
            <li
              key={job.job_id}
              data-job-status={bucket}
              className="flex min-w-0 flex-col gap-0.5 border-b border-border py-2 last:border-b-0"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 text-sm font-medium break-words whitespace-normal text-foreground">
                  {typeLabel(job.type)}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium break-words whitespace-normal",
                    bucket === "failed"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                >
                  {statusLabel(job.status)}
                </span>
                {inProgress && job.attempts > 0 ? (
                  <span className="text-xs font-medium break-words whitespace-normal text-muted-foreground">
                    {t("attemptOf", {
                      current: job.attempts,
                      max: MAX_ATTEMPTS_DISPLAY,
                    })}
                  </span>
                ) : null}
              </div>
              {bucket === "failed" ? (
                <span className="text-xs font-medium break-words whitespace-normal text-destructive">
                  {mapJobError(job.type, job.error, t)}
                </span>
              ) : null}
              {bucket === "uncertain" ? (
                <span className="text-xs font-medium break-words whitespace-normal text-muted-foreground">
                  {t("jobUncertainHint")}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
