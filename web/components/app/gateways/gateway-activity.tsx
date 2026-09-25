"use client";

import { useEffect, useState } from "react";
import {
  Check,
  LoaderCircle,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { GatewayFeedback } from "@/components/app/gateways/gateway-feedback";
import { GatewayStatusBadge } from "@/components/app/gateways/gateway-connection-state";
import {
  applyActivityFetchResult,
  normalizeJobStatus,
  type ActivityFetchOutcome,
  type JobStatusPresentation,
} from "@/components/app/gateways/gateways-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiClient } from "@/lib/api-client";
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

/** Honest subtitle from payload fields only — never invent a source name. */
function jobSubtitle(
  job: GatewayJobStatusOut,
  dash: string
): string {
  const payload = job.payload as Record<string, unknown> | null | undefined;
  if (!payload || typeof payload !== "object") return dash;
  for (const key of [
    "source_name",
    "source",
    "title",
    "query",
    "name",
  ] as const) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return dash;
}

function JobStatusIcon({
  status,
  bucket,
}: {
  status: string;
  bucket: JobStatusPresentation;
}) {
  const className = "size-4 shrink-0 text-foreground";
  if (bucket === "done") return <Check className={className} aria-hidden />;
  if (bucket === "failed" || bucket === "uncertain") {
    return <TriangleAlert className={className} aria-hidden />;
  }
  if (status === "running") {
    return <LoaderCircle className={`${className} animate-spin`} aria-hidden />;
  }
  return <Timer className={className} aria-hidden />;
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
  const tCommon = useTranslations("common");
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

  const dash = tCommon("dash");
  const count =
    outcome !== "loading" && outcome.status === "ready"
      ? outcome.jobs.length
      : 0;

  return (
    <section
      aria-label={t("jobQueueTitle")}
      className="flex w-full flex-col gap-3 rounded-lg border border-border-strong bg-ferry-surface p-5"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h2 className="text-base font-medium text-foreground">
          {t("jobQueueTitle")}
        </h2>
        <GatewayStatusBadge label={t("jobQueueCount", { count })} />
      </div>

      {outcome === "loading" ? (
        <div aria-busy="true" data-activity="loading" className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{t("activityLoading")}</p>
          <Skeleton className="h-8 w-full rounded-md" />
        </div>
      ) : null}

      {outcome !== "loading" && outcome.status === "unavailable" ? (
        <div data-activity="unavailable" className="flex flex-col gap-2">
          <GatewayFeedback
            role="alert"
            title={t("activityUnavailableTitle")}
            description={t("activityUnavailable")}
            className="flex-col items-stretch sm:flex-row sm:items-center"
          />
        </div>
      ) : null}

      {outcome !== "loading" && outcome.status === "empty" ? (
        <div data-activity="empty" className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            {t("activityEmpty")}
          </p>
        </div>
      ) : null}

      {outcome !== "loading" && outcome.status === "ready" ? (
        <ul data-activity="ready" className="flex min-w-0 flex-col">
          {outcome.jobs.map((job) => {
            const bucket = normalizeJobStatus(job.status);
            const inProgress = bucket === "active";
            return (
              <li
                key={job.job_id}
                data-job-status={bucket}
                className="flex min-w-0 items-center gap-3 border-b border-border-strong py-3 last:border-b-0"
              >
                <JobStatusIcon status={job.status} bucket={bucket} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="min-w-0 text-sm font-medium break-words whitespace-normal text-foreground">
                    {typeLabel(job.type)}
                    {inProgress && job.attempts > 0 ? (
                      <span className="ml-2 text-xs font-medium text-muted-foreground">
                        {t("attemptOf", {
                          current: job.attempts,
                          max: MAX_ATTEMPTS_DISPLAY,
                        })}
                      </span>
                    ) : null}
                  </p>
                  <p className="min-w-0 text-xs font-medium break-words whitespace-normal text-muted-foreground">
                    {bucket === "failed"
                      ? mapJobError(job.type, job.error, t)
                      : bucket === "uncertain"
                        ? t("jobUncertainHint")
                        : jobSubtitle(job, dash)}
                  </p>
                </div>
                <GatewayStatusBadge label={statusLabel(job.status)} />
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
