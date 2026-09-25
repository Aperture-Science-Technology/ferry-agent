/**
 * Pure helpers for Settings preferences and catalog presentation.
 * Kept free of React so they can be regression-tested with node:test.
 */

export type SavedDeliverySettings = {
  kindleEmail: string;
  defaultFormat: string;
};

/**
 * Detect unsaved preference edits against the last confirmed server values.
 * Empty Kindle email is treated like a cleared (null) value.
 */
export function settingsAreDirty(
  kindleEmail: string,
  defaultFormat: string,
  saved: SavedDeliverySettings
): boolean {
  return (
    kindleEmail.trim() !== saved.kindleEmail.trim() ||
    defaultFormat !== saved.defaultFormat
  );
}

/**
 * Payload for PATCH /api/v1/users/me — empty Kindle email becomes null.
 */
export function buildSettingsPatchPayload(
  kindleEmail: string,
  defaultFormat: string
): { kindle_email: string | null; default_format: string } {
  const trimmed = kindleEmail.trim();
  return {
    kindle_email: trimmed ? trimmed : null,
    default_format: defaultFormat,
  };
}

export function formatTokenLastUsed(
  value: string | null,
  locale: string,
  neverLabel: string
): string {
  if (!value) return neverLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return neverLabel;
  try {
    return date.toLocaleString(locale);
  } catch {
    return neverLabel;
  }
}

/** Compact calendar date for OPDS row meta (Pen « Créé le … »). */
export function formatTokenCreatedDate(
  value: string,
  locale: string
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return date.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

export type QrRenderState = "loading" | "ready" | "error";

/**
 * Map QR generation outcomes. Loading must not look like a permanent failure;
 * a failed generation stays distinct so the URL path remains usable.
 */
export function resolveQrRenderState(
  dataUrl: string | null,
  failed: boolean
): QrRenderState {
  if (failed) return "error";
  if (dataUrl) return "ready";
  return "loading";
}

/**
 * Soft-refresh for OPDS token list: a failed reload must not wipe known links.
 */
export function applyTokenListFetchResult<T>(
  previous: T[],
  result: T[] | null
): { ok: true; items: T[] } | { ok: false; items: T[]; keptPrevious: true } {
  if (result === null) {
    return { ok: false, items: previous, keptPrevious: true };
  }
  return { ok: true, items: result };
}
