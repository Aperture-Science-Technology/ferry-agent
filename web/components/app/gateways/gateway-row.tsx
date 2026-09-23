"use client";

import { Ban, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ConnectionDot } from "@/components/app/gateways/gateway-connection-state";
import { GatewayRecentActivity } from "@/components/app/gateways/gateway-activity";
import {
  gatewayConnectionPresentation,
  minutesUntil,
  type GatewayConnectionPresentation,
} from "@/components/app/gateways/gateways-state";
import { Button } from "@/components/ui/button";
import type { Gateway } from "@/lib/types";

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

export function connectionLabel(
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

function OfflineHint() {
  const t = useTranslations("access");
  return (
    <p className="text-xs font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
      {t("offlineLibraryHint")}
    </p>
  );
}

/** Statut — copper dot + label; offline keeps library hint. */
export function GatewayStatusLine({
  gateway,
  now,
}: {
  gateway: Gateway;
  now: number;
}) {
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

/** Pairing / TTL wait — pending ≠ connected; recreate when expired. */
export function GatewayPairingState({
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
          className="min-w-0 whitespace-normal rounded-md"
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
      <GatewayPairingState
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

export function GatewayActions({
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
          className="min-w-0 whitespace-normal rounded-md"
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
          className="min-w-0 whitespace-normal rounded-md"
          onClick={onRecreate}
        >
          {recreating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {recreateLabel}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="destructive"
        className="min-w-0 whitespace-normal rounded-md"
        onClick={onDelete}
      >
        <Trash2 />
        {deleteLabel}
      </Button>
    </div>
  );
}

/**
 * Pen-aligned Gateway row — name → status → last activity → detail → actions.
 * Paper list row (DeviceRow / StatusRow grammar): border-b, py-3, no SaaS card.
 */
export function GatewayRow({
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
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="min-w-0 text-base font-medium break-words whitespace-normal text-foreground">
          {gateway.name}
        </h2>
        <GatewayStatusLine gateway={gateway} now={now} />
        <p className="text-xs font-medium break-words whitespace-normal text-muted-foreground">
          {gateway.last_seen_at
            ? formatAppDate(gateway.last_seen_at, locale)
            : neverLabel}
        </p>
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
