/**
 * Pure helpers for Sources presentation and toggle updates.
 * Kept free of React so they can be regression-tested with node:test.
 */

export type KnownSourceType =
  | "gutenberg"
  | "standard_ebooks"
  | "upload"
  | "torrent_gateway";

export type SourceLike = {
  id: string;
  type: string;
  enabled: boolean;
};

export type SourceGroup = "openAccess" | "local";

export type SourceRowKind = "toggleable" | "upload" | "gateway_local";

/**
 * Confirmed activation when the API returned the source.
 * "unknown" when the list failed or a toggleable type is missing from the payload —
 * never invent "enabled".
 */
export type SourceAvailability =
  | "enabled"
  | "disabled"
  | "unknown"
  | "always_on"
  | "gateway";

/**
 * Distinct surface states for the Sources screen (T10 / harness).
 * Priority: unavailable > error > empty > partial > success.
 */
export type SourcesSurfaceState =
  | "unavailable"
  | "empty"
  | "partial"
  | "error"
  | "success";

export const OPEN_ACCESS_TYPES: readonly KnownSourceType[] = [
  "gutenberg",
  "standard_ebooks",
];

export const LOCAL_TYPES: readonly KnownSourceType[] = [
  "upload",
  "torrent_gateway",
];

/** Display order matching Pen Screen/Sources (flat editorial list). */
export const SOURCE_DISPLAY_TYPES: readonly KnownSourceType[] = [
  ...OPEN_ACCESS_TYPES,
  ...LOCAL_TYPES,
];

export function sourceGroup(type: KnownSourceType): SourceGroup {
  return OPEN_ACCESS_TYPES.includes(type) ? "openAccess" : "local";
}

export function sourceRowKind(type: KnownSourceType): SourceRowKind {
  if (type === "upload") return "upload";
  if (type === "torrent_gateway") return "gateway_local";
  return "toggleable";
}

/**
 * Real configure destinations only — open-access catalogs have no local folder.
 */
export function sourceConfigureHref(
  type: KnownSourceType
): "/app/bibliotheque" | "/app/gateways" | null {
  if (type === "upload") return "/app/bibliotheque";
  if (type === "torrent_gateway") return "/app/gateways";
  return null;
}

/**
 * Gateway hint first line — never claim "connected" without a real connected primary.
 * `null` / missing list → not connected (no inventing online).
 */
export type GatewayHintKind =
  | "connected"
  | "offline"
  | "pending"
  | "expired"
  | "revoked"
  | "unknown"
  | "none";

export function gatewayHintKind(
  presentation: string | null | undefined
): GatewayHintKind {
  if (presentation === "connected") return "connected";
  if (presentation === "offline") return "offline";
  if (presentation === "pending") return "pending";
  if (presentation === "expired") return "expired";
  if (presentation === "revoked") return "revoked";
  if (presentation === "unknown") return "unknown";
  return "none";
}

export function findSourceByType<T extends SourceLike>(
  sources: T[],
  type: KnownSourceType
): T | null {
  return sources.find((source) => source.type === type) ?? null;
}

export function sourceAvailability(
  type: KnownSourceType,
  sources: SourceLike[],
  sourcesUnavailable: boolean
): SourceAvailability {
  const kind = sourceRowKind(type);
  if (kind === "upload") return "always_on";
  if (kind === "gateway_local") return "gateway";

  if (sourcesUnavailable) return "unknown";

  const source = findSourceByType(sources, type);
  if (!source) return "unknown";
  return source.enabled ? "enabled" : "disabled";
}

export function canToggleSource(
  type: KnownSourceType,
  sources: SourceLike[],
  sourcesUnavailable: boolean
): boolean {
  if (sourceRowKind(type) !== "toggleable") return false;
  if (sourcesUnavailable) return false;
  return findSourceByType(sources, type) !== null;
}

/**
 * True when the list loaded but at least one activable catalog is missing —
 * never treat missing rows as enabled.
 */
export function hasPartialSources(
  sources: SourceLike[],
  sourcesUnavailable: boolean
): boolean {
  if (sourcesUnavailable) return false;
  if (sources.length === 0) return false;
  return OPEN_ACCESS_TYPES.some(
    (type) => findSourceByType(sources, type) === null
  );
}

export function sourcesSurfaceState(options: {
  sources: SourceLike[];
  sourcesUnavailable: boolean;
  updateError: string | null;
}): SourcesSurfaceState {
  if (options.sourcesUnavailable) return "unavailable";
  if (options.updateError) return "error";
  if (options.sources.length === 0) return "empty";
  if (hasPartialSources(options.sources, false)) return "partial";
  return "success";
}

/**
 * Apply a successful PATCH without inventing rows for other types.
 */
export function applySourceToggleSuccess<T extends SourceLike>(
  previous: T[],
  updated: T
): T[] {
  const index = previous.findIndex((source) => source.id === updated.id);
  if (index === -1) {
    return [...previous, updated];
  }
  return previous.map((source) => (source.id === updated.id ? updated : source));
}

/**
 * A failed toggle must leave the previous list untouched (no optimistic flip).
 */
export function applySourceToggleFailure<T extends SourceLike>(previous: T[]): T[] {
  return previous;
}
