"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/api-client";
import type { GatewayJobStatus, GatewayJobStatusOut } from "@/lib/types";

const POLL_INTERVAL_MS = 3_000;
const TIMEOUT_MS = 20 * 60 * 1_000;

export type GatewayJobPollStatus = GatewayJobStatus | "timeout" | null;

/**
 * Polls GET /api/v1/gateways/jobs/{id} every 3s until done/failed or 20 min.
 * Clears the interval on unmount; never applies state after unmount.
 */
export function useGatewayJob(jobId: string | null) {
  const { call } = useApiClient();
  const [status, setStatus] = useState<GatewayJobPollStatus>(null);
  const [libraryItemId, setLibraryItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!jobId) {
      setStatus(null);
      setLibraryItemId(null);
      setError(null);
      setAttempts(0);
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const startedAt = Date.now();

    const stop = () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const apply = (data: GatewayJobStatusOut) => {
      setStatus(data.status);
      setLibraryItemId(data.library_item_id ?? null);
      setError(data.error ?? null);
      setAttempts(data.attempts ?? 0);
      return data.status === "done" || data.status === "failed";
    };

    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - startedAt >= TIMEOUT_MS) {
        setStatus("timeout");
        stop();
        return;
      }
      try {
        const data = await call<GatewayJobStatusOut>(`/api/v1/gateways/jobs/${jobId}`);
        if (cancelled) return;
        if (apply(data)) stop();
      } catch {
        // Keep polling until timeout or unmount; transient errors are expected.
      }
    };

    void tick();
    intervalId = setInterval(() => {
      void tick();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      stop();
    };
  }, [jobId, call]);

  return { status, libraryItemId, error, attempts };
}
