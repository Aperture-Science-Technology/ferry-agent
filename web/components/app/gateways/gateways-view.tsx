"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Radio, Plus, Ban, Trash2, RefreshCw, Loader2, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/empty-state";
import {
  CreateGatewayDialog,
  GatewayCredentialsPanel,
  gatewayFromCredentials,
} from "@/components/app/gateways/create-gateway-dialog";
import {
  applyActivityFetchResult,
  gatewayConnectionPresentation,
  minutesUntil,
  normalizeJobStatus,
  type ActivityFetchOutcome,
  type GatewayConnectionPresentation,
} from "@/components/app/gateways/gateways-state";
import { CloudGatewayIllustration } from "@/components/illustrations";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { useApiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type {
  Gateway,
  GatewayCredentials,
  GatewayJobStatusOut,
  GatewayJobType,
} from "@/lib/types";

const MAX_ATTEMPTS_DISPLAY = 5;
const PENDING_POLL_MS = 5_000;
const PAIRED_POLL_MS = 15_000;
const NOW_TICK_MS = 15_000;

type AccessTranslations = ReturnType<typeof useTranslations<"access">>;

function formatAppDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatDuration(ms: number, t: AccessTranslations): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return t("durationMinutes", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 48) return t("durationHours", { count: hours });
  return t("durationDays", { count: Math.round(hours / 24) });
}

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

function connectionLabel(
  presentation: GatewayConnectionPresentation,
  gateway: Gateway,
  now: number,
  t: AccessTranslations
): string {
  switch (presentation) {
    case "pending":
      return t("statusPending");
    case "expired":
      return t("statusExpired");
    case "connected":
      return t("statusConnected");
    case "revoked":
      return t("statusRevoked");
    case "offline":
      return gateway.last_seen_at
        ? t("statusOfflineSince", {
            duration: formatDuration(
              now - new Date(gateway.last_seen_at).getTime(),
              t
            ),
          })
        : t("statusOffline");
    default:
      return t("statusUnknown");
  }
}

/** Copper ink status — never emerald “synced” teal. */
function ConnectionDot({
  presentation,
}: {
  presentation: GatewayConnectionPresentation;
}) {
  return (
    <span
      aria-hidden
      data-connection-dot={presentation}
      className={cn(
        "size-2 shrink-0 rounded-full",
        presentation === "connected" && "bg-primary",
        presentation === "pending" && "bg-primary/45",
        presentation === "expired" && "bg-destructive",
        presentation === "offline" && "bg-muted-foreground/45",
        presentation === "revoked" && "bg-muted-foreground/35",
        presentation === "unknown" && "bg-muted-foreground/40"
      )}
    />
  );
}

function SoftNotice({
  title,
  description,
  action,
  role = "status",
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  role?: "status" | "alert";
  className?: string;
}) {
  return (
    <div
      role={role}
      className={cn(
        "flex flex-col gap-3 border border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <p className="font-heading text-sm font-medium tracking-tight break-words whitespace-normal">
          {title}
        </p>
        <p className="text-sm leading-relaxed break-words whitespace-normal text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

function summarizeConnection(
  gateways: Gateway[],
  now: number
): GatewayConnectionPresentation | null {
  if (gateways.length === 0) return null;
  const presentations = gateways.map((g) =>
    gatewayConnectionPresentation(g, now)
  );
  const order: GatewayConnectionPresentation[] = [
    "connected",
    "pending",
    "expired",
    "offline",
    "revoked",
    "unknown",
  ];
  return order.find((p) => presentations.includes(p)) ?? "unknown";
}

function summaryLabel(
  presentation: GatewayConnectionPresentation,
  t: AccessTranslations
): string {
  switch (presentation) {
    case "pending":
      return t("statusPending");
    case "expired":
      return t("statusExpired");
    case "connected":
      return t("statusConnected");
    case "revoked":
      return t("statusRevoked");
    case "offline":
      return t("statusOffline");
    default:
      return t("statusUnknown");
  }
}

/**
 * Pen Gateway/ConnectionState gsDDr — paper surface, title/body, copper status.
 * Screen gEtgk / mobile mF0047 Conn.
 */
function GatewayConnectionPanel({
  gateways,
  now,
}: {
  gateways: Gateway[];
  now: number;
}) {
  const t = useTranslations("access");
  const summary = summarizeConnection(gateways, now);

  return (
    <section
      data-gateway-connection-panel
      className="flex max-w-[420px] flex-col gap-3 rounded-xl border border-border bg-card p-5"
    >
      <h2 className="font-heading text-lg font-medium tracking-tight break-words whitespace-normal text-foreground">
        {t("cloudLocalTitle")}
      </h2>
      <p className="text-sm font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
        {t("cloudLocalBody")}
      </p>
      {summary ? (
        <div
          className="flex min-w-0 items-center gap-2"
          data-connection-summary={summary}
        >
          <ConnectionDot presentation={summary} />
          <span className="text-sm font-medium break-words whitespace-normal text-foreground">
            {summaryLabel(summary, t)}
          </span>
        </div>
      ) : null}
    </section>
  );
}

/** Pen L00010 Gateway actions row — surface, not a SaaS card grid. */
function TorrentGatewayAction() {
  const t = useTranslations("access");

  return (
    <div
      data-testid="gateway-torrent-action"
      className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex min-w-0 items-start gap-3">
        <Share2
          aria-hidden
          className="mt-0.5 size-[18px] shrink-0 text-foreground"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-base font-medium break-words whitespace-normal text-foreground">
            {t("torrentActionTitle")}
          </p>
          <p className="text-xs font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
            {t("torrentActionDescription")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-fit min-w-0 whitespace-normal"
            render={<Link href="/app/sources">{t("torrentActionCta")}</Link>}
          />
        </div>
      </div>
    </div>
  );
}

function GatewayRecentActivity({
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
        <Skeleton className="h-8 w-full rounded-lg" />
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
        <SoftNotice
          role="alert"
          title={t("activityUnavailableTitle")}
          description={t("activityUnavailable")}
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

function PendingWaitState({
  gateway,
  now,
  recreating,
  onRecreate,
}: {
  gateway: Gateway;
  now: number;
  recreating: boolean;
  onRecreate: () => void;
}) {
  const t = useTranslations("access");
  const presentation = gatewayConnectionPresentation(gateway, now);
  const expired = presentation === "expired";
  const minutesLeft = minutesUntil(gateway.pairing_expires_at, now);

  let expiryMessage: string;
  if (minutesLeft === null) {
    expiryMessage = t("codeExpiresIn", {
      minutes: gateway.pairing_token_ttl_minutes ?? 15,
    });
  } else if (expired) {
    expiryMessage = t("codeExpired");
  } else if (minutesLeft === 1) {
    expiryMessage = t("codeExpiresSoon");
  } else {
    expiryMessage = t("codeExpiresIn", { minutes: minutesLeft });
  }

  return (
    <div
      className="flex max-w-lg flex-col gap-2 border-t border-border pt-3"
      data-pairing={expired ? "expired" : "pending"}
    >
      <p className="text-sm font-medium break-words whitespace-normal text-foreground">
        {expired ? t("statusExpired") : t("statusWaiting")}
      </p>
      <p className="text-sm font-medium break-words whitespace-normal text-muted-foreground">
        {expiryMessage}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant={expired ? "default" : "outline"}
          disabled={recreating}
          className="min-w-0 whitespace-normal"
          onClick={onRecreate}
        >
          {recreating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {t("recreateCodes")}
        </Button>
        <Link
          href="/docs#depannage"
          className="inline-block max-w-full text-sm font-medium break-words whitespace-normal text-foreground underline-offset-4 hover:underline"
        >
          {t("troubleshootLink")}
        </Link>
      </div>
    </div>
  );
}

function OfflineHint() {
  const t = useTranslations("access");
  return (
    <p className="text-xs font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
      {t("offlineLibraryHint")}
    </p>
  );
}

function AccessStatusLine({ gateway, now }: { gateway: Gateway; now: number }) {
  const t = useTranslations("access");
  const presentation = gatewayConnectionPresentation(gateway, now);
  const label = connectionLabel(presentation, gateway, now, t);

  return (
    <div className="min-w-0 space-y-1" data-connection={presentation}>
      <div className="flex min-w-0 items-center gap-2">
        <ConnectionDot presentation={presentation} />
        <span className="text-sm font-medium break-words whitespace-normal text-foreground">
          {label}
        </span>
      </div>
      {presentation === "offline" ? <OfflineHint /> : null}
    </div>
  );
}

function GatewayDetail({
  gateway,
  now,
  recreating,
  activityRefreshKey,
  onRecreate,
}: {
  gateway: Gateway;
  now: number;
  recreating: boolean;
  activityRefreshKey: number;
  onRecreate: () => void;
}) {
  if (gateway.status === "pending") {
    return (
      <PendingWaitState
        gateway={gateway}
        now={now}
        recreating={recreating}
        onRecreate={onRecreate}
      />
    );
  }

  if (gateway.status === "revoked") {
    return null;
  }

  return (
    <GatewayRecentActivity
      gatewayId={gateway.gateway_id}
      refreshKey={activityRefreshKey}
    />
  );
}

function GatewayActions({
  gateway,
  revoking,
  recreating,
  onRevoke,
  onRecreate,
  onDelete,
  revokeLabel,
  recreateLabel,
  deleteLabel,
}: {
  gateway: Gateway;
  revoking: boolean;
  recreating: boolean;
  onRevoke: () => void;
  onRecreate: () => void;
  onDelete: () => void;
  revokeLabel: string;
  recreateLabel: string;
  deleteLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {gateway.status === "paired" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={revoking}
          className="min-w-0 whitespace-normal"
          onClick={onRevoke}
        >
          {revoking ? <Loader2 className="animate-spin" /> : <Ban />}
          {revokeLabel}
        </Button>
      ) : null}
      {gateway.status === "revoked" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={recreating}
          className="min-w-0 whitespace-normal"
          onClick={onRecreate}
        >
          {recreating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {recreateLabel}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="destructive"
        className="min-w-0 whitespace-normal"
        onClick={onDelete}
      >
        <Trash2 />
        {deleteLabel}
      </Button>
    </div>
  );
}

/** Pen-aligned pairing / connection row — name → status → activity → actions. */
function GatewayRow({
  gateway,
  now,
  locale,
  neverLabel,
  recreating,
  revoking,
  activityRefreshKey,
  onRecreate,
  onRevoke,
  onDelete,
  revokeLabel,
  recreateLabel,
  deleteLabel,
}: {
  gateway: Gateway;
  now: number;
  locale: string;
  neverLabel: string;
  recreating: boolean;
  revoking: boolean;
  activityRefreshKey: number;
  onRecreate: () => void;
  onRevoke: () => void;
  onDelete: () => void;
  revokeLabel: string;
  recreateLabel: string;
  deleteLabel: string;
}) {
  return (
    <article
      data-testid="gateway-row"
      data-gateway-id={gateway.gateway_id}
      className="flex min-w-0 flex-col gap-3 border-b border-border py-3 last:border-b-0"
    >
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="min-w-0 text-base font-medium break-words whitespace-normal text-foreground">
            {gateway.name}
          </h2>
          <AccessStatusLine gateway={gateway} now={now} />
          <p className="text-xs font-medium break-words whitespace-normal text-muted-foreground">
            {gateway.last_seen_at
              ? formatAppDate(gateway.last_seen_at, locale)
              : neverLabel}
          </p>
        </div>
      </div>

      <GatewayDetail
        gateway={gateway}
        now={now}
        recreating={recreating}
        activityRefreshKey={activityRefreshKey}
        onRecreate={onRecreate}
      />

      <GatewayActions
        gateway={gateway}
        revoking={revoking}
        recreating={recreating}
        onRevoke={onRevoke}
        onRecreate={onRecreate}
        onDelete={onDelete}
        revokeLabel={revokeLabel}
        recreateLabel={recreateLabel}
        deleteLabel={deleteLabel}
      />
    </article>
  );
}

export function GatewaysView({
  title,
  description,
  initialGateways,
  gatewaysUnavailable,
}: {
  title: string;
  description: string;
  initialGateways: Gateway[];
  gatewaysUnavailable: boolean;
}) {
  const t = useTranslations("access");
  const tCreate = useTranslations("createAccess");
  const tCommon = useTranslations("common");
  const tBrand = useTranslations("brand");
  const locale = useLocale();
  const { call } = useApiClient();
  const [gateways, setGateways] = useState(initialGateways);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Gateway | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [recreatingId, setRecreatingId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<GatewayCredentials | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<Gateway | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [listRefreshFailed, setListRefreshFailed] = useState(false);

  const hasPending = gateways.some((gateway) => gateway.status === "pending");
  const hasPaired = gateways.some((gateway) => gateway.status === "paired");
  const needsClock = hasPending || hasPaired;
  const needsListPoll = hasPending || hasPaired;

  useEffect(() => {
    if (!needsClock) return;
    const tickId = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(tickId);
  }, [needsClock]);

  useEffect(() => {
    if (!needsListPoll) return;
    let cancelled = false;

    const refresh = async () => {
      try {
        const data = await call<Gateway[]>("/api/v1/gateways");
        if (cancelled) return;
        setGateways(data);
        setListRefreshFailed(false);
        setNow(Date.now());
        setActivityRefreshKey((key) => key + 1);
      } catch {
        if (!cancelled) setListRefreshFailed(true);
      }
    };

    const intervalMs = hasPending ? PENDING_POLL_MS : PAIRED_POLL_MS;
    const pollId = setInterval(() => {
      void refresh();
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, [needsListPoll, hasPending, call]);

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await call(`/api/v1/gateways/revoke`, {
        method: "POST",
        body: JSON.stringify({ gateway_id: revokeTarget.gateway_id }),
      });
      setGateways((prev) =>
        prev.map((g) =>
          g.gateway_id === revokeTarget.gateway_id
            ? { ...g, status: "revoked" }
            : g
        )
      );
      toast.success(t("toastRevoked"));
      setRevokeTarget(null);
    } catch {
      toast.error(t("toastRevokeFailed"));
    } finally {
      setRevoking(false);
    }
  }

  async function recreate(gateway: Gateway) {
    setRecreatingId(gateway.gateway_id);
    try {
      const created = await call<GatewayCredentials>(
        `/api/v1/gateways/${gateway.gateway_id}/recreate`,
        { method: "POST" }
      );
      setCredentials(created);
      setGateways((prev) =>
        prev.map((g) =>
          g.gateway_id === gateway.gateway_id
            ? gatewayFromCredentials(created, g.name)
            : g
        )
      );
    } catch {
      toast.error(t("toastRecreateFailed"));
    } finally {
      setRecreatingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await call(`/api/v1/gateways/${deleteTarget.gateway_id}`, {
        method: "DELETE",
      });
      setGateways((prev) =>
        prev.filter((g) => g.gateway_id !== deleteTarget.gateway_id)
      );
      toast.success(t("toastDeleted"));
      setDeleteTarget(null);
    } catch {
      toast.error(t("toastDeleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  const createAction = (
    <Button
      onClick={() => setCreateOpen(true)}
      className="min-w-0 whitespace-normal"
    >
      <Plus />
      {t("createLink")}
    </Button>
  );

  const guideLink = (
    <Button
      variant="outline"
      className="min-w-0 whitespace-normal"
      render={<Link href="/docs">{t("guideLink")}</Link>}
    />
  );

  const headerActions = (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {guideLink}
      {createAction}
    </div>
  );

  return (
    <div
      className="flex min-w-0 flex-col gap-6 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      data-testid="gateways-pen-layout"
    >
      {/* Pen Header/PageTitle Hd0003 + mobile Top mF0047 */}
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
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {headerActions}
        </div>
      </header>

      <GatewayConnectionPanel gateways={gateways} now={now} />

      <p className="max-w-3xl text-sm font-medium leading-relaxed break-words whitespace-normal text-muted-foreground md:text-sm">
        <span className="md:hidden">{t("pageHintMobile")}</span>
        <span className="hidden md:inline">{t("pageHint")}</span>
      </p>

      {listRefreshFailed && gateways.length > 0 ? (
        <SoftNotice
          title={t("listRefreshFailedTitle")}
          description={t("listRefreshFailed")}
        />
      ) : null}

      {gatewaysUnavailable && gateways.length === 0 ? (
        <div role="alert" data-gateways-state="unavailable">
          <EmptyState
            icon={Radio}
            title={t("emptyUnavailableTitle")}
            description={t("emptyUnavailable")}
          />
        </div>
      ) : gateways.length === 0 ? (
        <div data-gateways-state="empty">
          <EmptyState
            visual={<CloudGatewayIllustration />}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={
              <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
                {createAction}
                {guideLink}
              </div>
            }
          />
        </div>
      ) : (
        <div data-gateways-state="ready" className="flex min-w-0 flex-col gap-6">
          <Reveal>
            <div data-testid="gateways-rows">
              <RevealGroup className="flex min-w-0 flex-col">
                {gateways.map((gateway) => (
                  <RevealItem key={gateway.gateway_id}>
                    <GatewayRow
                      gateway={gateway}
                      now={now}
                      locale={locale}
                      neverLabel={tCommon("never")}
                      recreating={recreatingId === gateway.gateway_id}
                      revoking={
                        revoking &&
                        revokeTarget?.gateway_id === gateway.gateway_id
                      }
                      activityRefreshKey={activityRefreshKey}
                      onRecreate={() => void recreate(gateway)}
                      onRevoke={() => setRevokeTarget(gateway)}
                      onDelete={() => setDeleteTarget(gateway)}
                      revokeLabel={t("revoke")}
                      recreateLabel={t("recreateCodes")}
                      deleteLabel={t("delete")}
                    />
                  </RevealItem>
                ))}
              </RevealGroup>
            </div>
          </Reveal>

          <TorrentGatewayAction />
        </div>
      )}

      {/* Empty state still surfaces torrent context when ready is empty */}
      {gateways.length === 0 && !gatewaysUnavailable ? (
        <TorrentGatewayAction />
      ) : null}

      <CreateGatewayDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(gateway) => setGateways((prev) => [gateway, ...prev])}
      />

      <Dialog
        open={credentials !== null}
        onOpenChange={(open) => !open && setCredentials(null)}
      >
        <DialogContent className="gap-4 p-6 sm:max-w-[420px]">
          <DialogHeader className="gap-2">
            <DialogTitle className="font-heading text-xl font-medium tracking-tight break-words whitespace-normal">
              {tCreate("createdTitle")}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium break-words whitespace-normal">
              {tCreate("createdDescription")}
            </DialogDescription>
          </DialogHeader>
          {credentials ? (
            <GatewayCredentialsPanel credentials={credentials} />
          ) : null}
          <DialogFooter className="mx-0 mb-0 gap-2 rounded-none border-0 bg-transparent p-0 sm:justify-end">
            <Button
              onClick={() => setCredentials(null)}
              className="whitespace-normal"
            >
              {tCommon("done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !open && !revoking && setRevokeTarget(null)}
      >
        <DialogContent className="gap-4 p-6 sm:max-w-[400px]">
          <DialogHeader className="gap-2">
            <DialogTitle className="font-heading text-lg font-medium tracking-tight break-words whitespace-normal">
              {t("revokeConfirmTitle")}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium break-words whitespace-normal">
              {t("revokeConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mx-0 mb-0 gap-2 rounded-none border-0 bg-transparent p-0 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setRevokeTarget(null)}
              disabled={revoking}
              autoFocus
              className="whitespace-normal"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmRevoke()}
              disabled={revoking}
              className="whitespace-normal"
            >
              {revoking ? <Loader2 className="animate-spin" /> : <Ban />}
              {t("revoke")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <DialogContent className="gap-4 p-6 sm:max-w-[400px]">
          <DialogHeader className="gap-2">
            <DialogTitle className="font-heading text-lg font-medium tracking-tight break-words whitespace-normal">
              {t("deleteConfirmTitle")}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium break-words whitespace-normal">
              {t("deleteConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mx-0 mb-0 gap-2 rounded-none border-0 bg-transparent p-0 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              autoFocus
              className="whitespace-normal"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleting}
              className="whitespace-normal"
            >
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
