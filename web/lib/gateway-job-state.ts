import type { GatewayJobStatus } from "@/lib/types";

export type GatewayJobPollStatus = GatewayJobStatus | "timeout" | null;

export type GatewayJobPollSnapshot = {
  jobId: string;
  status: Exclude<GatewayJobPollStatus, null>;
  libraryItemId: string | null;
  error: string | null;
  attempts: number;
};

/**
 * Derive the view for the current jobId without resetting via an effect.
 * Stale snapshots from a previous jobId are ignored.
 */
export function resolveGatewayJobView(
  jobId: string | null,
  snapshot: GatewayJobPollSnapshot | null
): {
  status: GatewayJobPollStatus;
  libraryItemId: string | null;
  error: string | null;
  attempts: number;
} {
  if (!jobId || !snapshot || snapshot.jobId !== jobId) {
    return {
      status: null,
      libraryItemId: null,
      error: null,
      attempts: 0,
    };
  }
  return {
    status: snapshot.status,
    libraryItemId: snapshot.libraryItemId,
    error: snapshot.error,
    attempts: snapshot.attempts,
  };
}
