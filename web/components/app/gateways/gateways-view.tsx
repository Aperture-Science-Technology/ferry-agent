"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Radio, Plus, Ban, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/app/empty-state";
import { SectionHeader } from "@/components/app/section-header";
import { StatusDot } from "@/components/status-dot";
import {
  CreateGatewayDialog,
  GatewayCredentialsPanel,
  gatewayFromCredentials,
} from "@/components/app/gateways/create-gateway-dialog";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { useApiClient } from "@/lib/api-client";
import type {
  Gateway,
  GatewayCredentials,
  GatewayJobStatus,
  GatewayJobStatusOut,
  GatewayJobType,
} from "@/lib/types";

const MAX_ATTEMPTS_DISPLAY = 5;
const PENDING_POLL_MS = 5_000;
const PAIRED_POLL_MS = 15_000;
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

function isPairingExpired(gateway: Gateway, now: number): boolean {
  if (gateway.status !== "pending") return false;
  const left = minutesUntil(gateway.pairing_expires_at, now);
  return left !== null && left <= 0;
}

function mapJobError(
  type: GatewayJobType,
  error: string | null | undefined,
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

function GatewayRecentActivity({
  gatewayId,
  refreshKey,
}: {
  gatewayId: string;
  refreshKey: number;
}) {
  const t = useTranslations("access");
  const { call } = useApiClient();
  const [jobs, setJobs] = useState<GatewayJobStatusOut[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setJobs(null);
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
  }, [gatewayId, call, refreshKey]);

  function typeLabel(type: GatewayJobType) {
    return type === "search" ? t("jobTypeSearch") : t("jobTypeFetch");
  }

  function statusLabel(status: GatewayJobStatus) {
    if (status === "done") return t("jobStatusDone");
    if (status === "failed") return t("jobStatusFailed");
    return t("jobStatusActive");
  }

  if (jobs === null) {
    return (
      <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
        <p className="text-sm font-medium">{t("recentActivity")}</p>
        <p className="text-sm text-muted-foreground">{t("activityLoading")}</p>
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    );
  }

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
                className="flex min-w-0 flex-col gap-0.5 text-sm text-muted-foreground"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="min-w-0 truncate text-foreground">{typeLabel(job.type)}</span>
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
                  <span className="text-xs break-words text-destructive/90">
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
  recreating,
  onRecreate,
}: {
  gateway: Gateway;
  now: number;
  recreating: boolean;
  onRecreate: () => void;
}) {
  const t = useTranslations("access");
  const minutesLeft = minutesUntil(gateway.pairing_expires_at, now);
  const expired = minutesLeft !== null && minutesLeft <= 0;

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
    <div className="mt-3 max-w-sm space-y-2 border-t border-border/40 pt-3">
      <p className="text-sm font-medium text-foreground">{t("statusWaiting")}</p>
      <p className="text-sm break-words text-muted-foreground">{expiryMessage}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant={expired ? "default" : "outline"}
          disabled={recreating}
          onClick={onRecreate}
        >
          {recreating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {t("recreateCodes")}
        </Button>
        <Link
          href="/docs#depannage"
          className="inline-block text-sm text-foreground underline-offset-4 hover:underline"
        >
          {t("troubleshootLink")}
        </Link>
      </div>
    </div>
  );
}

function AccessStatusCell({ gateway, now }: { gateway: Gateway; now: number }) {
  const t = useTranslations("access");

  if (gateway.status === "pending") {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot online={false} />
        <Badge variant="secondary" className="max-w-full">
          <span className="truncate">
            {isPairingExpired(gateway, now) ? t("statusExpired") : t("statusPending")}
          </span>
        </Badge>
      </div>
    );
  }

  if (gateway.status === "revoked") {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot online={false} />
        <Badge variant="secondary" className="max-w-full">
          <span className="truncate">{t("statusRevoked")}</span>
        </Badge>
      </div>
    );
  }

  const online = isGatewayOnline(gateway, now);
  if (online) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot online />
        <Badge variant="secondary" className="max-w-full">
          <span className="truncate">{t("statusConnected")}</span>
        </Badge>
      </div>
    );
  }

  const offlineLabel = gateway.last_seen_at
    ? t("statusOfflineSince", {
        duration: formatDuration(now - new Date(gateway.last_seen_at).getTime(), t),
      })
    : t("statusOffline");

  return (
    <div className="flex min-w-0 items-center gap-2">
      <StatusDot online={false} />
      <Badge variant="secondary" className="max-w-full">
        <span className="truncate">{offlineLabel}</span>
      </Badge>
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
      <PendingWaitState
        gateway={gateway}
        now={now}
        recreating={recreating}
        onRecreate={onRecreate}
      />
    );
  }

  return (
    <GatewayRecentActivity
      gatewayId={gateway.gateway_id}
      refreshKey={activityRefreshKey}
    />
  );
}

function GatewayActions({
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
    <div className="flex flex-wrap items-center justify-end gap-2">
      {gateway.status === "paired" ? (
        <Button size="sm" variant="outline" disabled={revoking} onClick={onRevoke}>
          {revoking ? <Loader2 className="animate-spin" /> : <Ban />}
          {revokeLabel}
        </Button>
      ) : null}
      {gateway.status === "revoked" ? (
        <Button size="sm" variant="outline" disabled={recreating} onClick={onRecreate}>
          {recreating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {recreateLabel}
        </Button>
      ) : null}
      <Button size="sm" variant="destructive" onClick={onDelete}>
        <Trash2 />
        {deleteLabel}
      </Button>
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
  const tCreate = useTranslations("createAccess");
  const tCommon = useTranslations("common");
  const { call } = useApiClient();
  const [gateways, setGateways] = useState(initialGateways);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Gateway | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [recreatingId, setRecreatingId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<GatewayCredentials | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Gateway | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);

  const hasPending = gateways.some((gateway) => gateway.status === "pending");
  const hasPaired = gateways.some((gateway) => gateway.status === "paired");
  const needsClock = hasPending || hasPaired;
  const needsListPoll = hasPending || hasPaired;

  useEffect(() => {
    if (!needsClock) return;
    const tickId = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(tickId);
  }, [needsClock]);

  useEffect(() => {
    if (!needsListPoll) return;
    let cancelled = false;

    const refresh = async () => {
      try {
        const data = await call<Gateway[]>("/api/v1/gateways");
        if (!cancelled) {
          setGateways(data);
          setNow(Date.now());
          setActivityRefreshKey((key) => key + 1);
        }
      } catch {
        // Keep showing the last known list; the next tick retries.
      }
    };

    const intervalMs = hasPending ? PENDING_POLL_MS : PAIRED_POLL_MS;
    const pollId = setInterval(() => {
      void refresh();
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, [needsListPoll, hasPending, call]);

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await call(`/api/v1/gateways/revoke`, {
        method: "POST",
        body: JSON.stringify({ gateway_id: revokeTarget.gateway_id }),
      });
      setGateways((prev) =>
        prev.map((g) =>
          g.gateway_id === revokeTarget.gateway_id ? { ...g, status: "revoked" } : g
        )
      );
      toast.success(t("toastRevoked"));
      setRevokeTarget(null);
    } catch {
      toast.error(t("toastRevokeFailed"));
    } finally {
      setRevoking(false);
    }
  }

  async function recreate(gateway: Gateway) {
    setRecreatingId(gateway.gateway_id);
    try {
      const created = await call<GatewayCredentials>(
        `/api/v1/gateways/${gateway.gateway_id}/recreate`,
        { method: "POST" }
      );
      setCredentials(created);
      setGateways((prev) =>
        prev.map((g) =>
          g.gateway_id === gateway.gateway_id
            ? gatewayFromCredentials(created, g.name)
            : g
        )
      );
    } catch {
      toast.error(t("toastRecreateFailed"));
    } finally {
      setRecreatingId(null);
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

  const createAction = (
    <Button onClick={() => setCreateOpen(true)}>
      <Plus />
      {t("createLink")}
    </Button>
  );

  return (
    <div className="space-y-6">
      <Reveal>
        <SectionHeader
          title={t("sectionTitle")}
          description={
            gateways.length > 0
              ? t("countLabel", { count: gateways.length })
              : t("watchFolderHint")
          }
          action={createAction}
        />

        {gatewaysUnavailable && gateways.length === 0 ? (
          <Alert>
            <Radio />
            <AlertTitle>{t("emptyTitle")}</AlertTitle>
            <AlertDescription>{t("emptyUnavailable")}</AlertDescription>
          </Alert>
        ) : gateways.length === 0 ? (
          <EmptyState
            icon={Radio}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={createAction}
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{t("watchFolderHint")}</p>

            {/* Mobile / narrow: cards */}
            <RevealGroup className="grid gap-3 md:hidden">
              {gateways.map((gateway) => (
                <RevealItem key={gateway.gateway_id}>
                  <Card size="sm" className="bg-card/60">
                    <CardContent className="space-y-3">
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="line-clamp-2 text-sm break-words">
                          {gateway.name}
                        </CardTitle>
                        <CardDescription>
                          <AccessStatusCell gateway={gateway} now={now} />
                        </CardDescription>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {gateway.last_seen_at
                          ? new Date(gateway.last_seen_at).toLocaleString()
                          : tCommon("never")}
                      </p>

                      <GatewayDetail
                        gateway={gateway}
                        now={now}
                        recreating={recreatingId === gateway.gateway_id}
                        activityRefreshKey={activityRefreshKey}
                        onRecreate={() => void recreate(gateway)}
                      />

                      <GatewayActions
                        gateway={gateway}
                        revoking={revoking && revokeTarget?.gateway_id === gateway.gateway_id}
                        recreating={recreatingId === gateway.gateway_id}
                        onRevoke={() => setRevokeTarget(gateway)}
                        onRecreate={() => void recreate(gateway)}
                        onDelete={() => setDeleteTarget(gateway)}
                        revokeLabel={t("revoke")}
                        recreateLabel={t("recreateCodes")}
                        deleteLabel={t("delete")}
                      />
                    </CardContent>
                  </Card>
                </RevealItem>
              ))}
            </RevealGroup>

            {/* Desktop: table */}
            <Reveal className="hidden overflow-hidden rounded-xl border border-border/60 md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
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
                        <div className="min-w-0 space-y-1">
                          <span className="line-clamp-2 break-words">{gateway.name}</span>
                          <GatewayDetail
                            gateway={gateway}
                            now={now}
                            recreating={recreatingId === gateway.gateway_id}
                            activityRefreshKey={activityRefreshKey}
                            onRecreate={() => void recreate(gateway)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <AccessStatusCell gateway={gateway} now={now} />
                      </TableCell>
                      <TableCell className="align-top whitespace-nowrap text-muted-foreground">
                        {gateway.last_seen_at
                          ? new Date(gateway.last_seen_at).toLocaleString()
                          : tCommon("never")}
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <GatewayActions
                          gateway={gateway}
                          revoking={revoking && revokeTarget?.gateway_id === gateway.gateway_id}
                          recreating={recreatingId === gateway.gateway_id}
                          onRevoke={() => setRevokeTarget(gateway)}
                          onRecreate={() => void recreate(gateway)}
                          onDelete={() => setDeleteTarget(gateway)}
                          revokeLabel={t("revoke")}
                          recreateLabel={t("recreateCodes")}
                          deleteLabel={t("delete")}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Reveal>
          </>
        )}
      </Reveal>

      <CreateGatewayDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(gateway) => setGateways((prev) => [gateway, ...prev])}
      />

      <Dialog
        open={credentials !== null}
        onOpenChange={(open) => !open && setCredentials(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tCreate("createdTitle")}</DialogTitle>
            <DialogDescription>{tCreate("createdDescription")}</DialogDescription>
          </DialogHeader>
          {credentials ? <GatewayCredentialsPanel credentials={credentials} /> : null}
          <DialogFooter>
            <Button onClick={() => setCredentials(null)}>{tCommon("done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !open && !revoking && setRevokeTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("revokeConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("revokeConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeTarget(null)}
              disabled={revoking}
            >
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmRevoke} disabled={revoking}>
              {revoking ? <Loader2 className="animate-spin" /> : <Ban />}
              {t("revoke")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("deleteConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
