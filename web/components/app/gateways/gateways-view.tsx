"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Radio, Plus, Ban, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/status-dot";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/app/empty-state";
import { CreateGatewayDialog } from "@/components/app/gateways/create-gateway-dialog";
import { useApiClient } from "@/lib/api-client";
import type { Gateway, GatewayJobStatus, GatewayJobStatusOut, GatewayJobType } from "@/lib/types";

const MAX_ATTEMPTS_DISPLAY = 5;
const PENDING_POLL_MS = 5_000;
const NOW_TICK_MS = 15_000;
const DEFAULT_ONLINE_SECONDS = 60;

type AccessTranslations = ReturnType<typeof useTranslations<"access">>;

function formatDuration(ms: number, t: AccessTranslations): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return t("durationMinutes", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 48) return t("durationHours", { count: hours });
  return t("durationDays", { count: Math.round(hours / 24) });
}

function isGatewayOnline(gateway: Gateway, now: number): boolean {
  if (!gateway.last_seen_at) return false;
  const windowMs = (gateway.gateway_online_seconds ?? DEFAULT_ONLINE_SECONDS) * 1000;
  return now - new Date(gateway.last_seen_at).getTime() <= windowMs;
}

function minutesUntil(expiresAt: string | null | undefined, now: number): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - now) / 60_000);
}

function mapJobError(
  type: GatewayJobType,
  error: string | null,
  t: AccessTranslations
): string {
  if (error) {
    if (/abandonn[ée] après \d+ tentatives/i.test(error) || /abandoned after \d+ attempts/i.test(error)) {
      return t("jobFailedAbandoned");
    }
    if (/malveillant|VirusTotal/i.test(error)) return t("jobFailedMalicious");
    if (/volumineux|too large/i.test(error)) return t("jobFailedTooLarge");
    if (/livre reconnu|Formats acceptés|not a recognized/i.test(error)) {
      return t("jobFailedBadFormat");
    }
    if (/revoked/i.test(error)) return t("jobFailedRevoked");
  }
  return type === "search" ? t("jobFailedSearch") : t("jobFailedGeneric");
}

function GatewayRecentActivity({ gatewayId }: { gatewayId: string }) {
  const t = useTranslations("access");
  const { call } = useApiClient();
  const [jobs, setJobs] = useState<GatewayJobStatusOut[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    call<GatewayJobStatusOut[]>(`/api/v1/gateways/${gatewayId}/jobs?limit=20`)
      .then((data) => {
        if (!cancelled) setJobs(data);
      })
      .catch(() => {
        if (!cancelled) setJobs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [gatewayId, call]);

  function typeLabel(type: GatewayJobType) {
    return type === "search" ? t("jobTypeSearch") : t("jobTypeFetch");
  }

  function statusLabel(status: GatewayJobStatus) {
    if (status === "done") return t("jobStatusDone");
    if (status === "failed") return t("jobStatusFailed");
    return t("jobStatusActive");
  }

  if (jobs === null) return null;

  return (
    <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
      <p className="text-sm font-medium">{t("recentActivity")}</p>
      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("activityEmpty")}</p>
      ) : (
        <ul className="space-y-1.5">
          {jobs.map((job) => {
            const inProgress =
              job.status === "pending" || job.status === "queued" || job.status === "running";
            return (
              <li
                key={job.job_id}
                className="flex flex-col gap-0.5 text-sm text-muted-foreground"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-foreground">{typeLabel(job.type)}</span>
                  <Badge variant="secondary">{statusLabel(job.status)}</Badge>
                  {inProgress && job.attempts > 0 && (
                    <span className="text-xs">
                      {t("attemptOf", {
                        current: job.attempts,
                        max: MAX_ATTEMPTS_DISPLAY,
                      })}
                    </span>
                  )}
                </div>
                {job.status === "failed" && (
                  <span className="text-xs text-destructive/90">
                    {mapJobError(job.type, job.error, t)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PendingWaitState({
  gateway,
  now,
}: {
  gateway: Gateway;
  now: number;
}) {
  const t = useTranslations("access");
  const minutesLeft = minutesUntil(gateway.pairing_expires_at, now);

  let expiryMessage: string;
  if (minutesLeft === null) {
    expiryMessage = t("codeExpiresIn", {
      minutes: gateway.pairing_token_ttl_minutes ?? 15,
    });
  } else if (minutesLeft <= 0) {
    expiryMessage = t("codeExpired");
  } else if (minutesLeft === 1) {
    expiryMessage = t("codeExpiresSoon");
  } else {
    expiryMessage = t("codeExpiresIn", { minutes: minutesLeft });
  }

  return (
    <div className="mt-3 max-w-sm space-y-2 border-t border-border/40 pt-3">
      <p className="text-sm font-medium text-foreground">{t("statusWaiting")}</p>
      <p className="text-sm text-muted-foreground">{expiryMessage}</p>
      <Link
        href="/docs#depannage"
        className="inline-block text-sm text-foreground underline-offset-4 hover:underline"
      >
        {t("troubleshootLink")}
      </Link>
    </div>
  );
}

function AccessStatusCell({ gateway, now }: { gateway: Gateway; now: number }) {
  const t = useTranslations("access");

  if (gateway.status === "pending") {
    return (
      <div className="flex items-center gap-2">
        <StatusDot online={false} />
        <Badge variant="secondary">{t("statusPending")}</Badge>
      </div>
    );
  }

  if (gateway.status === "revoked") {
    return (
      <div className="flex items-center gap-2">
        <StatusDot online={false} />
        <Badge variant="secondary">{t("statusRevoked")}</Badge>
      </div>
    );
  }

  const online = isGatewayOnline(gateway, now);
  if (online) {
    return (
      <div className="flex items-center gap-2">
        <StatusDot online />
        <Badge variant="secondary">{t("statusConnected")}</Badge>
      </div>
    );
  }

  const offlineLabel = gateway.last_seen_at
    ? t("statusOfflineSince", {
        duration: formatDuration(now - new Date(gateway.last_seen_at).getTime(), t),
      })
    : t("statusOffline");

  return (
    <div className="flex items-center gap-2">
      <StatusDot online={false} />
      <Badge variant="secondary">{offlineLabel}</Badge>
    </div>
  );
}

export function GatewaysView({
  initialGateways,
  gatewaysUnavailable,
}: {
  initialGateways: Gateway[];
  gatewaysUnavailable: boolean;
}) {
  const t = useTranslations("access");
  const tCommon = useTranslations("common");
  const { call } = useApiClient();
  const [gateways, setGateways] = useState(initialGateways);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Gateway | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const hasPending = gateways.some((gateway) => gateway.status === "pending");
  const needsClock =
    hasPending || gateways.some((gateway) => gateway.status === "paired");

  useEffect(() => {
    if (!needsClock) return;
    const tickId = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(tickId);
  }, [needsClock]);

  useEffect(() => {
    if (!hasPending) return;
    let cancelled = false;

    const refresh = async () => {
      try {
        const data = await call<Gateway[]>("/api/v1/gateways");
        if (!cancelled) {
          setGateways(data);
          setNow(Date.now());
        }
      } catch {
        // Keep showing the last known list; the next tick retries.
      }
    };

    const pollId = setInterval(() => {
      void refresh();
    }, PENDING_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, [hasPending, call]);

  async function revoke(gateway: Gateway) {
    setRevokingId(gateway.gateway_id);
    try {
      await call(`/api/v1/gateways/revoke`, {
        method: "POST",
        body: JSON.stringify({ gateway_id: gateway.gateway_id }),
      });
      setGateways((prev) =>
        prev.map((g) =>
          g.gateway_id === gateway.gateway_id ? { ...g, status: "revoked" } : g
        )
      );
      toast.success(t("toastRevoked"));
    } catch {
      toast.error(t("toastRevokeFailed"));
    } finally {
      setRevokingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await call(`/api/v1/gateways/${deleteTarget.gateway_id}`, { method: "DELETE" });
      setGateways((prev) => prev.filter((g) => g.gateway_id !== deleteTarget.gateway_id));
      toast.success(t("toastDeleted"));
      setDeleteTarget(null);
    } catch {
      toast.error(t("toastDeleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          {t("createLink")}
        </Button>
      </div>

      {gateways.length === 0 ? (
        <EmptyState
          icon={Radio}
          title={t("emptyTitle")}
          description={gatewaysUnavailable ? t("emptyUnavailable") : t("emptyDescription")}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colName")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead>{t("colLastSeen")}</TableHead>
                <TableHead className="text-right">{t("colAction")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gateways.map((gateway) => (
                <TableRow key={gateway.gateway_id}>
                  <TableCell className="align-top font-medium">
                    <div>{gateway.name}</div>
                    {gateway.status === "pending" ? (
                      <PendingWaitState gateway={gateway} now={now} />
                    ) : (
                      <GatewayRecentActivity gatewayId={gateway.gateway_id} />
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <AccessStatusCell gateway={gateway} now={now} />
                  </TableCell>
                  <TableCell className="align-top text-muted-foreground">
                    {gateway.last_seen_at
                      ? new Date(gateway.last_seen_at).toLocaleString()
                      : tCommon("never")}
                  </TableCell>
                  <TableCell className="align-top text-right">
                    <div className="flex justify-end gap-2">
                      {gateway.status === "paired" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={revokingId === gateway.gateway_id}
                          onClick={() => revoke(gateway)}
                        >
                          <Ban />
                          {t("revoke")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteTarget(gateway)}
                      >
                        <Trash2 />
                        {t("delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateGatewayDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(gateway) => setGateways((prev) => [gateway, ...prev])}
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("deleteConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              <Trash2 />
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
