"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Radio, Plus, Ban, Trash2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CreateGatewayDialog,
  GatewayCredentialsPanel,
  gatewayFromCredentials,
} from "@/components/app/gateways/create-gateway-dialog";
import {
  GatewayConnectionState,
  GatewayModuleDetails,
  pickPrimaryGateway,
} from "@/components/app/gateways/gateway-connection-state";
import {
  GatewayEmpty,
  GatewayFeedback,
} from "@/components/app/gateways/gateway-feedback";
import { GatewayRecentActivity } from "@/components/app/gateways/gateway-activity";
import { GatewayRow } from "@/components/app/gateways/gateway-row";
import { GatewayTorrentAction } from "@/components/app/gateways/gateway-torrent-action";
import { PageHeader } from "@/components/app/page-header";
import { CloudGatewayIllustration } from "@/components/illustrations";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { useApiClient } from "@/lib/api-client";
import type { Gateway, GatewayCredentials } from "@/lib/types";

const PENDING_POLL_MS = 5_000;
const PAIRED_POLL_MS = 15_000;
const NOW_TICK_MS = 15_000;

export function GatewaysView({
  title,
  description,
  initialGateways,
  gatewaysUnavailable,
}: {
  title: string;
  description: string;
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
  const [credentials, setCredentials] = useState<GatewayCredentials | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<Gateway | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [listRefreshFailed, setListRefreshFailed] = useState(false);

  const hasPending = gateways.some((gateway) => gateway.status === "pending");
  const hasPaired = gateways.some((gateway) => gateway.status === "paired");
  const needsClock = hasPending || hasPaired;
  const needsListPoll = hasPending || hasPaired;
  const primary = pickPrimaryGateway(gateways, now);

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
        if (cancelled) return;
        setGateways(data);
        setListRefreshFailed(false);
        setNow(Date.now());
        setActivityRefreshKey((key) => key + 1);
      } catch {
        if (!cancelled) setListRefreshFailed(true);
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
          g.gateway_id === revokeTarget.gateway_id
            ? { ...g, status: "revoked" }
            : g
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
      await call(`/api/v1/gateways/${deleteTarget.gateway_id}`, {
        method: "DELETE",
      });
      setGateways((prev) =>
        prev.filter((g) => g.gateway_id !== deleteTarget.gateway_id)
      );
      toast.success(t("toastDeleted"));
      setDeleteTarget(null);
    } catch {
      toast.error(t("toastDeleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  const createAction = (
    <Button
      onClick={() => setCreateOpen(true)}
      className="min-w-0 whitespace-normal"
    >
      <Plus />
      {t("createLink")}
    </Button>
  );

  const guideLink = (
    <Button
      variant="ghost"
      className="min-w-0 whitespace-normal"
      render={<Link href="/docs">{t("guideLink")}</Link>}
    />
  );

  const headerActions = (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      {guideLink}
      {createAction}
    </div>
  );

  const rows = (
    <Reveal>
      <div data-testid="gateways-rows">
        <RevealGroup className="flex min-w-0 flex-col">
          {gateways.map((gateway) => (
            <RevealItem key={gateway.gateway_id}>
              <GatewayRow
                gateway={gateway}
                now={now}
                isPrimary={primary?.gateway_id === gateway.gateway_id}
                recreating={recreatingId === gateway.gateway_id}
                revoking={
                  revoking && revokeTarget?.gateway_id === gateway.gateway_id
                }
                onRecreate={() => void recreate(gateway)}
                onRevoke={() => setRevokeTarget(gateway)}
                onDelete={() => setDeleteTarget(gateway)}
                revokeLabel={t("revoke")}
                recreateLabel={t("recreateCodes")}
                deleteLabel={t("delete")}
              />
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </Reveal>
  );

  const readyBody =
    primary != null ? (
      <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <GatewayConnectionState
            gateway={primary}
            now={now}
            neverLabel={tCommon("never")}
            pairing={primary.status === "pending"}
            revoking={
              revoking && revokeTarget?.gateway_id === primary.gateway_id
            }
            recreating={recreatingId === primary.gateway_id}
            onPair={() => void recreate(primary)}
            onRevoke={() => setRevokeTarget(primary)}
            onRecreate={() => void recreate(primary)}
          />
          <GatewayModuleDetails gateway={primary} />
          {rows}
          <GatewayTorrentAction />
        </div>
        <div className="flex w-full flex-col gap-5 lg:w-[480px] lg:shrink-0">
          {primary.status === "paired" ? (
            <GatewayRecentActivity
              gatewayId={primary.gateway_id}
              refreshKey={activityRefreshKey}
            />
          ) : (
            <section
              aria-label={t("jobQueueTitle")}
              className="flex w-full flex-col gap-3 rounded-lg border border-border-strong bg-ferry-surface p-5"
            >
              <div className="flex min-w-0 items-center justify-between gap-3">
                <h2 className="text-base font-medium text-foreground">
                  {t("jobQueueTitle")}
                </h2>
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("jobQueueUnavailable")}
              </p>
            </section>
          )}
        </div>
      </div>
    ) : null;

  const body =
    gatewaysUnavailable && gateways.length === 0 ? (
      <div role="alert" data-gateways-state="unavailable">
        <GatewayEmpty
          icon={Radio}
          title={t("emptyUnavailableTitle")}
          description={t("emptyUnavailable")}
        />
      </div>
    ) : gateways.length === 0 ? (
      <div data-gateways-state="empty" className="flex min-w-0 flex-col gap-5">
        <GatewayEmpty
          visual={<CloudGatewayIllustration />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
              {createAction}
              {guideLink}
            </div>
          }
        />
        <GatewayTorrentAction />
      </div>
    ) : (
      <div data-gateways-state="ready">{readyBody}</div>
    );

  return (
    <div
      className="flex min-w-0 flex-col gap-5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      data-testid="gateways-pen-layout"
    >
      <PageHeader
        title={title}
        description={description}
        action={headerActions}
      />

      {listRefreshFailed && gateways.length > 0 ? (
        <GatewayFeedback
          title={t("listRefreshFailedTitle")}
          description={t("listRefreshFailed")}
          className="flex-col items-stretch sm:flex-row sm:items-center"
        />
      ) : null}

      <div data-testid="gateways-body">{body}</div>

      <CreateGatewayDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(gateway) => setGateways((prev) => [gateway, ...prev])}
      />

      <Dialog
        open={credentials !== null}
        onOpenChange={(open) => !open && setCredentials(null)}
      >
        <DialogContent className="gap-4 p-6 sm:max-w-[420px]">
          <DialogHeader className="gap-2">
            <DialogTitle className="text-xl font-medium tracking-tight break-words whitespace-normal">
              {tCreate("createdTitle")}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium break-words whitespace-normal">
              {tCreate("createdDescription")}
            </DialogDescription>
          </DialogHeader>
          {credentials ? (
            <GatewayCredentialsPanel credentials={credentials} />
          ) : null}
          <DialogFooter className="mx-0 mb-0 gap-2 rounded-none border-0 bg-transparent p-0 sm:justify-end">
            <Button
              onClick={() => setCredentials(null)}
              className="whitespace-normal"
            >
              {tCommon("done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !open && !revoking && setRevokeTarget(null)}
      >
        <DialogContent className="gap-4 p-6 sm:max-w-[400px]">
          <DialogHeader className="gap-2">
            <DialogTitle className="text-lg font-medium tracking-tight break-words whitespace-normal">
              {t("revokeConfirmTitle")}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium break-words whitespace-normal">
              {t("revokeConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mx-0 mb-0 gap-2 rounded-none border-0 bg-transparent p-0 sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setRevokeTarget(null)}
              disabled={revoking}
              autoFocus
              className="whitespace-normal"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmRevoke()}
              disabled={revoking}
              className="whitespace-normal"
            >
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
        <DialogContent className="gap-4 p-6 sm:max-w-[400px]">
          <DialogHeader className="gap-2">
            <DialogTitle className="text-lg font-medium tracking-tight break-words whitespace-normal">
              {t("deleteConfirmTitle")}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium break-words whitespace-normal">
              {t("deleteConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mx-0 mb-0 gap-2 rounded-none border-0 bg-transparent p-0 sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              autoFocus
              className="whitespace-normal"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleting}
              className="whitespace-normal"
            >
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
