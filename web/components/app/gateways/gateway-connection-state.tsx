"use client";

import { Ban, Link2, Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  gatewayConnectionPresentation,
  type GatewayConnectionPresentation,
} from "@/components/app/gateways/gateways-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Gateway } from "@/lib/types";

type AccessTranslations = ReturnType<typeof useTranslations<"access">>;

/** Pen Badge/Status — surface-2 pill, border-strong, 6px marker + 12/500. */
export function GatewayStatusBadge({
  label,
  presentation,
  className,
}: {
  label: string;
  presentation?: GatewayConnectionPresentation;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-border-strong bg-ferry-surface-2 px-2.5 py-1 text-xs font-medium text-foreground",
        className
      )}
    >
      <ConnectionDot presentation={presentation ?? "unknown"} />
      <span className="min-w-0 break-words">{label}</span>
    </span>
  );
}

/** Status marker — ferry-transfer when connected; muted otherwise. */
export function ConnectionDot({
  presentation,
}: {
  presentation: GatewayConnectionPresentation;
}) {
  return (
    <span
      aria-hidden
      data-connection-dot={presentation}
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        presentation === "connected" && "bg-ferry-transfer",
        presentation === "pending" && "bg-ferry-transfer/45",
        presentation === "expired" && "bg-destructive",
        presentation === "offline" && "bg-muted-foreground/45",
        presentation === "revoked" && "bg-muted-foreground/35",
        presentation === "unknown" && "bg-muted-foreground/40"
      )}
    />
  );
}

/**
 * Prefer connected → pending → expired → offline → revoked → first in list.
 * Adaptation: Pen draws one module; the app picks a primary among N.
 */
export function pickPrimaryGateway(
  gateways: Gateway[],
  now: number
): Gateway | null {
  if (gateways.length === 0) return null;
  const order: GatewayConnectionPresentation[] = [
    "connected",
    "pending",
    "expired",
    "offline",
    "revoked",
    "unknown",
  ];
  const presentations = gateways.map((g) => ({
    gateway: g,
    presentation: gatewayConnectionPresentation(g, now),
  }));
  for (const wanted of order) {
    const hit = presentations.find((p) => p.presentation === wanted);
    if (hit) return hit.gateway;
  }
  return gateways[0] ?? null;
}

export function summarizeConnection(
  gateways: Gateway[],
  now: number
): GatewayConnectionPresentation | null {
  const primary = pickPrimaryGateway(gateways, now);
  if (!primary) return null;
  return gatewayConnectionPresentation(primary, now);
}

export function summaryLabel(
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

function formatDuration(ms: number, t: AccessTranslations): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return t("durationMinutes", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 48) return t("durationHours", { count: hours });
  return t("durationDays", { count: Math.round(hours / 24) });
}

function formatSeenAgo(
  lastSeenAt: string | null | undefined,
  now: number,
  t: AccessTranslations,
  neverLabel: string
): string {
  if (!lastSeenAt) return neverLabel;
  const ms = now - new Date(lastSeenAt).getTime();
  if (ms < 0) return neverLabel;
  return t("seenAgo", { duration: formatDuration(ms, t) });
}

/**
 * Pen Gateway/ConnectionState gsDDr — ferry-surface, pad 20, gap 12, radius-lg.
 * Bound to the primary gateway (see pickPrimaryGateway).
 */
export function GatewayConnectionState({
  gateway,
  now,
  neverLabel,
  pairing,
  revoking,
  recreating,
  onPair,
  onRevoke,
  onRecreate,
}: {
  gateway: Gateway | null;
  now: number;
  neverLabel: string;
  pairing?: boolean;
  revoking?: boolean;
  recreating?: boolean;
  onPair?: () => void;
  onRevoke?: () => void;
  onRecreate?: () => void;
}) {
  const t = useTranslations("access");
  const tCommon = useTranslations("common");
  const presentation = gateway
    ? gatewayConnectionPresentation(gateway, now)
    : null;
  const showPair =
    gateway != null &&
    (presentation === "pending" || presentation === "expired") &&
    onPair != null;
  // Paired (connected or offline) can still be revoked — same API contract as before.
  const showRevoke =
    gateway != null &&
    gateway.status === "paired" &&
    onRevoke != null;
  const showRecreate =
    gateway != null && gateway.status === "revoked" && onRecreate != null;

  return (
    <section
      data-gateway-connection-panel
      data-connection-summary={presentation ?? undefined}
      className="flex w-full flex-col gap-3 rounded-lg border border-border-strong bg-ferry-surface p-5"
    >
      <h2 className="text-lg font-medium break-words whitespace-normal text-foreground">
        {t("cloudLocalTitle")}
      </h2>
      <p className="text-sm font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
        {t("cloudLocalBody")}
      </p>

      {presentation && gateway ? (
        <div className="flex min-w-0 items-center justify-between gap-3">
          <GatewayStatusBadge
            presentation={presentation}
            label={summaryLabel(presentation, t)}
          />
          <p className="shrink-0 text-xs font-medium text-muted-foreground">
            {formatSeenAgo(gateway.last_seen_at, now, t, neverLabel)}
          </p>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">
          {t("endpointLabel")}
        </p>
        <p className="text-sm font-medium break-all whitespace-normal text-foreground">
          {tCommon("dash")}
        </p>
      </div>

      {showPair || showRevoke || showRecreate ? (
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
          {showPair ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={pairing || recreating}
              className="min-w-0 whitespace-normal"
              onClick={onPair}
            >
              {recreating ? <Loader2 className="animate-spin" /> : <Link2 />}
              {t("pair")}
            </Button>
          ) : null}
          {showRevoke ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={revoking}
              className="min-w-0 whitespace-normal"
              onClick={onRevoke}
            >
              {revoking ? <Loader2 className="animate-spin" /> : <Ban />}
              {t("revoke")}
            </Button>
          ) : null}
          {showRecreate ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={recreating}
              className="min-w-0 whitespace-normal"
              onClick={onRecreate}
            >
              {recreating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {t("recreate")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Pen « Détails du module » — unknown fields stay as dash (never invented). */
export function GatewayModuleDetails({ gateway }: { gateway: Gateway }) {
  const t = useTranslations("access");
  const tCommon = useTranslations("common");
  const dash = tCommon("dash");

  const rows: { label: string; value: string }[] = [
    { label: t("moduleDetailId"), value: gateway.gateway_id || dash },
    { label: t("moduleDetailVersion"), value: dash },
    { label: t("moduleDetailSources"), value: dash },
    { label: t("moduleDetailLastScan"), value: dash },
  ];

  return (
    <section
      data-gateway-module-details
      aria-label={t("moduleDetailsTitle")}
      className="flex w-full flex-col gap-3 rounded-lg border border-border-strong bg-ferry-surface p-5"
    >
      <h2 className="text-base font-medium text-foreground">
        {t("moduleDetailsTitle")}
      </h2>
      <dl className="flex min-w-0 flex-col gap-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex min-w-0 items-center justify-between gap-3"
          >
            <dt className="text-[13px] font-medium text-muted-foreground">
              {row.label}
            </dt>
            <dd className="min-w-0 text-right text-[13px] font-medium break-all text-foreground">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
