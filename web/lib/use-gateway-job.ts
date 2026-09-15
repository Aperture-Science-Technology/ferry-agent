"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/api-client";
import {
  resolveGatewayJobView,
  type GatewayJobPollSnapshot,
} from "@/lib/gateway-job-state";
import type { GatewayJobStatusOut } from "@/lib/types";

export type { GatewayJobPollStatus } from "@/lib/gateway-job-state";

const POLL_INTERVAL_MS = 3_000;
const TIMEOUT_MS = 20 * 60 * 1_000;

/**
 * Polls GET /api/v1/gateways/jobs/{id} every 3s until done/failed or 20 min.
 * Clears the interval on unmount; never applies state after unmount.
 */
export function useGatewayJob(jobId: string | null) {
  const { call } = useApiClient();
  const [snapshot, setSnapshot] = useState<GatewayJobPollSnapshot | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const startedAt = Date.now();
    const trackedId = jobId;

    const stop = () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const apply = (data: GatewayJobStatusOut) => {
      setSnapshot({
        jobId: trackedId,
        status: data.status,
        libraryItemId: data.library_item_id ?? null,
        error: data.error ?? null,
        attempts: data.attempts ?? 0,
      });
      return data.status === "done" || data.status === "failed";
    };

    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - startedAt >= TIMEOUT_MS) {
        setSnapshot((prev) => ({
          jobId: trackedId,
          status: "timeout",
          libraryItemId: prev?.jobId === trackedId ? prev.libraryItemId : null,
          error: prev?.jobId === trackedId ? prev.error : null,
          attempts: prev?.jobId === trackedId ? prev.attempts : 0,
        }));
        stop();
        return;
      }
      try {
        const data = await call<GatewayJobStatusOut>(
          `/api/v1/gateways/jobs/${trackedId}`
        );
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

  return resolveGatewayJobView(jobId, snapshot);
}
