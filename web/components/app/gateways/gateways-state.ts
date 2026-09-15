/**
 * Pure helpers for Gateway connection / activity presentation.
 * Kept free of React so they can be regression-tested with node:test.
 */

export type GatewayListItem = {
  gateway_id: string;
  status: string;
  last_seen_at?: string | null;
  pairing_expires_at?: string | null;
  gateway_online_seconds?: number | null;
};

export type GatewayConnectionPresentation =
  | "pending"
  | "expired"
  | "connected"
  | "offline"
  | "revoked"
  | "unknown";

export type JobStatusPresentation = "active" | "done" | "failed" | "uncertain";

export type ActivityFetchOutcome<T> =
  | { status: "empty" }
  | { status: "unavailable" }
  | { status: "ready"; jobs: T[] };

export type GatewayListFetchOutcome<T> =
  | { ok: true; items: T[] }
  | { ok: false; items: T[]; keptPrevious: true };

export const DEFAULT_ONLINE_SECONDS = 60;

export function minutesUntil(
  expiresAt: string | null | undefined,
  now: number
): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - now) / 60_000);
}

export function isPairingExpired(
  gateway: Pick<GatewayListItem, "status" | "pairing_expires_at">,
  now: number
): boolean {
  if (gateway.status !== "pending") return false;
  const left = minutesUntil(gateway.pairing_expires_at, now);
  return left !== null && left <= 0;
}

export function isGatewayOnline(
  gateway: Pick<GatewayListItem, "last_seen_at" | "gateway_online_seconds">,
  now: number,
  defaultOnlineSeconds = DEFAULT_ONLINE_SECONDS
): boolean {
  if (!gateway.last_seen_at) return false;
  const windowMs =
    (gateway.gateway_online_seconds ?? defaultOnlineSeconds) * 1000;
  return now - new Date(gateway.last_seen_at).getTime() <= windowMs;
}

/**
 * Map API gateway fields to a single UI connection bucket.
 * Offline never means the cloud webapp is down.
 */
export function gatewayConnectionPresentation(
  gateway: GatewayListItem,
  now: number
): GatewayConnectionPresentation {
  if (gateway.status === "pending") {
    return isPairingExpired(gateway, now) ? "expired" : "pending";
  }
  if (gateway.status === "revoked") return "revoked";
  if (gateway.status === "paired") {
    return isGatewayOnline(gateway, now) ? "connected" : "offline";
  }
  return "unknown";
}

/**
 * Normalize job status for UI. Unknown values stay visible as uncertain —
 * never silently treated as success or empty.
 */
export function normalizeJobStatus(status: string): JobStatusPresentation {
  if (status === "pending" || status === "queued" || status === "running") {
    return "active";
  }
  if (status === "done") return "done";
  if (status === "failed") return "failed";
  return "uncertain";
}

/**
 * Activity fetch: null means unavailable (error), [] means truly empty.
 * Never collapse a failed fetch into an empty list presentation.
 */
export function applyActivityFetchResult<T>(
  result: T[] | null
): ActivityFetchOutcome<T> {
  if (result === null) return { status: "unavailable" };
  if (result.length === 0) return { status: "empty" };
  return { status: "ready", jobs: result };
}

/**
 * Soft-refresh: a failed list reload must not wipe known gateways.
 */
export function applyGatewayListFetchResult<T>(
  previous: T[],
  result: T[] | null
): GatewayListFetchOutcome<T> {
  if (result === null) {
    return { ok: false, items: previous, keptPrevious: true };
  }
  return { ok: true, items: result };
}

/**
 * Copy helper for secrets / blocks. Success only after the write resolves.
 * Callers must keep the value selectable when this returns false.
 */
export async function copyTextToClipboard(
  value: string,
  writeText: (text: string) => Promise<void> = (text) =>
    navigator.clipboard.writeText(text)
): Promise<boolean> {
  try {
    await writeText(value);
    return true;
  } catch {
    return false;
  }
}
