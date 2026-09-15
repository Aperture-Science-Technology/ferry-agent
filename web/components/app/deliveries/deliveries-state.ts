/**
 * Pure helpers for delivery list refresh / status presentation.
 * Kept free of React so they can be regression-tested with node:test.
 */

export type DeliveryStatusCode = "queued" | "sent" | "delivered" | "failed";

export type DeliveryListItem = {
  id: string;
  status: string;
};

/** Statuses that still need follow-up (requested / in progress). */
export function isActiveDeliveryStatus(status: string): boolean {
  return status === "queued" || status === "sent";
}

/** Statuses that should stop bounded polling. */
export function isTerminalDeliveryStatus(status: string): boolean {
  return status === "delivered" || status === "failed";
}

/**
 * Normalize API status for UI buckets.
 * Unknown values stay visible as "unknown" — never silently map to delivered.
 */
export function normalizeDeliveryStatus(
  status: string
): DeliveryStatusCode | "unknown" {
  if (
    status === "queued" ||
    status === "sent" ||
    status === "delivered" ||
    status === "failed"
  ) {
    return status;
  }
  return "unknown";
}

export function hasActiveDeliveries(items: DeliveryListItem[]): boolean {
  return items.some((item) => isActiveDeliveryStatus(item.status));
}

/**
 * Merge a fresh list into the current one.
 * - Prefer fresh order and membership when the fetch succeeds.
 * - Preserve previously known fields when a fresh row omits optional enrichment
 *   (title/author/device_label/download_url) so a soft refresh never blanks the UI.
 */
export function mergeDeliveryJobs<T extends DeliveryListItem & Record<string, unknown>>(
  previous: T[],
  fresh: T[]
): T[] {
  const prevById = new Map(previous.map((job) => [job.id, job]));
  return fresh.map((job) => {
    const prior = prevById.get(job.id);
    if (!prior) return job;
    const merged = { ...prior, ...job };
    for (const key of Object.keys(prior) as Array<keyof T>) {
      const nextVal = job[key];
      if (nextVal === null || nextVal === undefined || nextVal === "") {
        const prevVal = prior[key];
        if (prevVal !== null && prevVal !== undefined && prevVal !== "") {
          merged[key] = prevVal;
        }
      }
    }
    return merged;
  });
}

export type DeliveryFetchOutcome<T> =
  | { ok: true; items: T[] }
  | { ok: false; items: T[]; keptPrevious: true };

/**
 * Apply a list fetch result without turning a network failure into an empty list
 * when the caller already has known deliveries.
 */
export function applyDeliveryFetchResult<T extends DeliveryListItem>(
  previous: T[],
  result: T[] | null
): DeliveryFetchOutcome<T> {
  if (result === null) {
    return { ok: false, items: previous, keptPrevious: true };
  }
  return { ok: true, items: mergeDeliveryJobs(previous, result) };
}
