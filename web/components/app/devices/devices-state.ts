/**
 * Pure helpers for device list display / soft refresh.
 * Kept free of React so they can be regression-tested with node:test.
 */

export type DeviceListItem = {
  id: string;
  name?: string | null;
  brand: string;
  model?: string | null;
  cloud_linked: boolean;
  cloud_provider?: string | null;
};

/**
 * Prefer the user-given name; otherwise brand (+ model) label.
 * Never returns an empty string when brandLabel is provided.
 */
export function deviceDisplayName(
  device: Pick<DeviceListItem, "name" | "model">,
  brandLabel: string
): string {
  const trimmed = device.name?.trim();
  if (trimmed) return trimmed;
  if (device.model?.trim()) return `${brandLabel} — ${device.model.trim()}`;
  return brandLabel;
}

/**
 * Soft-refresh semantics: a failed reload must not wipe known devices.
 */
export function applyDeviceFetchResult<T>(
  previous: T[],
  result: T[] | null
): { ok: true; items: T[] } | { ok: false; items: T[]; keptPrevious: true } {
  if (result === null) {
    return { ok: false, items: previous, keptPrevious: true };
  }
  return { ok: true, items: result };
}

export type CloudLinkPresentation = "linked" | "not_linked" | "error";

/**
 * Cloud account presentation for a device row or an OAuth callback.
 * An OAuth `error` result must never present as linked/success — even if the
 * device was already cloud-linked from a previous successful link.
 */
export function cloudLinkPresentation(
  device: Pick<DeviceListItem, "cloud_linked">,
  oauthResult?: "ok" | "error" | null
): CloudLinkPresentation {
  if (oauthResult === "error") return "error";
  return device.cloud_linked ? "linked" : "not_linked";
}
