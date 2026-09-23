"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Tablet,
  Plus,
  Link2,
  Trash2,
  Pencil,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/app/empty-state";
import { NewDeviceDialog } from "@/components/app/devices/new-device-dialog";
import { EditDeviceDialog } from "@/components/app/devices/edit-device-dialog";
import { CloudLinkDialog } from "@/components/app/devices/cloud-link-dialog";
import { BrandBadge } from "@/components/app/devices/brand-badge";
import { conversionProfileLabel } from "@/components/app/devices/conversion-profile-field";
import {
  applyDeviceFetchResult,
  cloudLinkPresentation,
  deviceDisplayName,
} from "@/components/app/devices/devices-state";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { useApiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Device } from "@/lib/types";

const CLOUD_LINK_MESSAGE = "ferry-cloud-link";

function formatAppDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function DeviceIdentity({
  device,
  muted = true,
}: {
  device: Device;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-medium",
        muted ? "text-muted-foreground" : "text-foreground"
      )}
    >
      <BrandBadge brand={device.brand} className="min-w-0 max-w-full" />
      {device.model ? (
        <span className="min-w-0 max-w-full break-words whitespace-normal">
          — {device.model}
        </span>
      ) : null}
    </span>
  );
}

function DeviceMetaLine({ parts }: { parts: string[] }) {
  const visible = parts.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <p className="text-xs font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
      {visible.map((part, index) => (
        <span key={`${part}-${index}`}>
          {index > 0 ? (
            <span className="mx-1.5 text-border" aria-hidden>
              ·
            </span>
          ) : null}
          <span>{part}</span>
        </span>
      ))}
    </p>
  );
}

function CloudState({
  device,
  linkedDropbox,
  linkedDrive,
  linked,
  notLinked,
}: {
  device: Device;
  linkedDropbox: string;
  linkedDrive: string;
  linked: string;
  notLinked: string;
}) {
  const presentation = cloudLinkPresentation(device);
  if (presentation !== "linked") {
    return (
      <span className="shrink-0 text-sm font-medium break-words whitespace-normal text-muted-foreground">
        {notLinked}
      </span>
    );
  }
  const label =
    device.cloud_provider === "dropbox"
      ? linkedDropbox
      : device.cloud_provider === "drive"
        ? linkedDrive
        : linked;
  return (
    <span className="max-w-[40%] shrink-0 text-sm font-medium break-words whitespace-normal text-muted-foreground">
      {label}
    </span>
  );
}

function DeviceActions({
  device,
  onEdit,
  onLink,
  onDelete,
  editLabel,
  linkLabel,
  deleteLabel,
  disabled,
}: {
  device: Device;
  onEdit: () => void;
  onLink: () => void;
  onDelete: () => void;
  editLabel: string;
  linkLabel: string;
  deleteLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="min-w-0 whitespace-normal"
        onClick={onEdit}
        disabled={disabled}
      >
        <Pencil />
        {editLabel}
      </Button>
      {device.delivery_tier === "B" ? (
        <Button
          size="sm"
          variant="outline"
          className="min-w-0 whitespace-normal"
          onClick={onLink}
          disabled={disabled}
        >
          <Link2 />
          {linkLabel}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="destructive"
        className="min-w-0 whitespace-normal"
        onClick={onDelete}
        disabled={disabled}
      >
        <Trash2 />
        {deleteLabel}
      </Button>
    </div>
  );
}

/** Pen Device/DeviceRow yTrhR — mark + meta + state, gap 16, pad 12 0, bottom border. */
function DeviceRow({
  device,
  title,
  identity,
  meta,
  cloud,
  actions,
}: {
  device: Device;
  title: ReactNode;
  identity: ReactNode;
  meta: ReactNode;
  cloud: ReactNode;
  actions: ReactNode;
}) {
  return (
    <article
      data-testid="device-row"
      data-device-id={device.id}
      className="flex min-w-0 flex-col gap-3 border-b border-border py-3 last:border-b-0"
    >
      <div className="flex min-w-0 items-center gap-4">
        <BrandBadge
          brand={device.brand}
          showLabel={false}
          size="lg"
          className="shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="min-w-0 text-base font-medium break-words whitespace-normal text-foreground">
            {title}
          </h2>
          {identity}
          {meta}
        </div>
        {cloud}
      </div>
      {actions}
    </article>
  );
}

export function DevicesView({
  title,
  description,
  initialDevices,
  devicesUnavailable,
  cloudLinkStatus,
}: {
  title: string;
  description: string;
  initialDevices: Device[];
  devicesUnavailable: boolean;
  cloudLinkStatus?: "ok" | "error";
}) {
  const t = useTranslations("devices");
  const tCloud = useTranslations("cloudLink");
  const tEditDevice = useTranslations("editDevice");
  const tNewDevice = useTranslations("newDevice");
  const tBrand = useTranslations("brand");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { call } = useApiClient();
  const [devices, setDevices] = useState(initialDevices);
  const [unavailable, setUnavailable] = useState(
    devicesUnavailable && initialDevices.length === 0
  );
  const [refreshError, setRefreshError] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Device | null>(null);
  const [linkTarget, setLinkTarget] = useState<Device | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const cloudLinkHandled = useRef(false);

  const oauthPresentation = cloudLinkPresentation(
    { cloud_linked: false },
    cloudLinkStatus ?? null
  );

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      if (!opts?.silent) setRefreshing(true);
      try {
        const fresh = await call<Device[]>("/api/v1/devices");
        setDevices((prev) => applyDeviceFetchResult(prev, fresh).items);
        setUnavailable(false);
        setRefreshError(false);
      } catch {
        setDevices((prev) => {
          const outcome = applyDeviceFetchResult(prev, null);
          if (outcome.items.length === 0) {
            setUnavailable(true);
          } else {
            setRefreshError(true);
          }
          return outcome.items;
        });
      } finally {
        refreshingRef.current = false;
        setRefreshing(false);
      }
    },
    [call]
  );

  useEffect(() => {
    if (!cloudLinkStatus) return;
    if (cloudLinkHandled.current) return;
    cloudLinkHandled.current = true;

    // Popup OAuth : notifier la fenetre d'origine puis se fermer.
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: CLOUD_LINK_MESSAGE, status: cloudLinkStatus },
        window.location.origin
      );
      window.close();
      return;
    }

    if (cloudLinkStatus === "ok") {
      toast.success(tCloud("toastLinked"));
      void call<Device[]>("/api/v1/devices")
        .then((fresh) => {
          setDevices((prev) => applyDeviceFetchResult(prev, fresh).items);
          setUnavailable(false);
          setRefreshError(false);
        })
        .catch(() => {
          setRefreshError(true);
        });
    } else {
      toast.error(tCloud("toastFailed"));
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("cloud_link");
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }, [cloudLinkStatus, call, tCloud]);

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await call(`/api/v1/devices/${deleteTarget.id}`, { method: "DELETE" });
      setDevices((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      toast.success(t("toastDeleted"));
      setDeleteTarget(null);
    } catch {
      toast.error(t("toastDeleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  function brandLabel(brand: Device["brand"]) {
    return tNewDevice(`brands.${brand}`);
  }

  function syncLabel(device: Device) {
    return device.last_synced_at
      ? formatAppDate(device.last_synced_at, locale)
      : tCommon("never");
  }

  const createAction = (
    <Button
      onClick={() => setCreateOpen(true)}
      className="min-w-0 whitespace-normal"
    >
      <Plus />
      {t("newDevice")}
    </Button>
  );

  const headerActions = (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void refresh()}
        disabled={refreshing}
        aria-busy={refreshing}
        className="whitespace-normal"
      >
        {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        {t("refresh")}
      </Button>
      {createAction}
    </div>
  );

  const retryButton = (
    <Button
      size="sm"
      variant="outline"
      onClick={() => void refresh()}
      disabled={refreshing}
      className="w-fit shrink-0 whitespace-normal"
    >
      {refreshing ? <Loader2 className="animate-spin" /> : null}
      {t("retry")}
    </Button>
  );

  const deleteName = deleteTarget
    ? deviceDisplayName(deleteTarget, brandLabel(deleteTarget.brand))
    : "";

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="devices-pen-layout">
      {/* Pen Header/PageTitle Hd0003 (28/14) + mobile Top mF003e (brand/22/12) */}
      <header className="flex min-h-[72px] flex-col justify-center gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="font-heading text-sm font-medium text-muted-foreground md:hidden">
            {tBrand("name")}
          </p>
          <h1 className="font-heading text-[22px] font-medium text-foreground md:text-[28px]">
            {title}
          </h1>
          <p className="text-xs font-medium text-muted-foreground md:text-sm">
            {description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {headerActions}
        </div>
      </header>

      {oauthPresentation === "error" ? (
        <div
          role="status"
          data-cloud-link="error"
          className="flex flex-col gap-3 border border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 space-y-1">
            <p className="font-heading text-sm font-medium tracking-tight">
              {t("cloudLinkFailedTitle")}
            </p>
            <p className="text-sm leading-relaxed break-words whitespace-normal text-muted-foreground">
              {t("cloudLinkFailedDescription")}
            </p>
          </div>
        </div>
      ) : null}

      {refreshError && devices.length > 0 ? (
        <div
          role="status"
          className="flex flex-col gap-3 border border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 space-y-1">
            <p className="font-heading text-sm font-medium tracking-tight">
              {t("refreshFailedTitle")}
            </p>
            <p className="text-sm leading-relaxed break-words whitespace-normal text-muted-foreground">
              {t("refreshFailedDescription")}
            </p>
          </div>
          {retryButton}
        </div>
      ) : null}

      {unavailable && devices.length === 0 ? (
        <div role="alert">
          <EmptyState
            icon={Tablet}
            title={t("unavailableTitle")}
            description={t("emptyUnavailable")}
            action={retryButton}
          />
        </div>
      ) : devices.length === 0 ? (
        <EmptyState
          icon={Tablet}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={createAction}
        />
      ) : (
        <Reveal>
          <div aria-busy={refreshing} data-testid="devices-rows">
            <RevealGroup className="flex min-w-0 flex-col">
              {devices.map((device) => {
                const hasCustomName = Boolean(device.name?.trim());
                const delivery = t(`tiers.${device.delivery_tier}`);
                const profile = conversionProfileLabel(
                  device.conversion_profile,
                  tEditDevice
                );
                return (
                  <RevealItem key={device.id}>
                    <DeviceRow
                      device={device}
                      title={
                        hasCustomName ? (
                          <span className="break-words whitespace-normal">
                            {device.name!.trim()}
                          </span>
                        ) : (
                          <DeviceIdentity device={device} muted={false} />
                        )
                      }
                      identity={
                        hasCustomName ? <DeviceIdentity device={device} /> : null
                      }
                      meta={
                        <DeviceMetaLine
                          parts={[profile, delivery, syncLabel(device)]}
                        />
                      }
                      cloud={
                        <CloudState
                          device={device}
                          linkedDropbox={t("linkedDropbox")}
                          linkedDrive={t("linkedDrive")}
                          linked={t("linked")}
                          notLinked={t("notLinked")}
                        />
                      }
                      actions={
                        <DeviceActions
                          device={device}
                          onEdit={() => setEditTarget(device)}
                          onLink={() => setLinkTarget(device)}
                          onDelete={() => setDeleteTarget(device)}
                          editLabel={t("edit")}
                          linkLabel={t("linkCloud")}
                          deleteLabel={t("delete")}
                          disabled={deleting}
                        />
                      }
                    />
                  </RevealItem>
                );
              })}
            </RevealGroup>
          </div>
        </Reveal>
      )}

      <NewDeviceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(device) => setDevices((prev) => [device, ...prev])}
      />
      <EditDeviceDialog
        key={editTarget?.id ?? "closed"}
        device={editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onUpdated={(device) =>
          setDevices((prev) =>
            prev.map((d) => (d.id === device.id ? device : d))
          )
        }
      />
      <CloudLinkDialog
        device={linkTarget}
        onOpenChange={(open) => !open && setLinkTarget(null)}
        onLinked={(device) =>
          setDevices((prev) =>
            prev.map((d) => (d.id === device.id ? device : d))
          )
        }
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <DialogContent className="gap-4 p-6 sm:max-w-[420px]">
          <DialogHeader className="gap-2">
            <DialogTitle className="font-heading text-xl font-medium tracking-tight">
              {t("deleteConfirmTitle")}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium break-words whitespace-normal">
              {t("deleteConfirmDescriptionNamed", { name: deleteName })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mx-0 mb-0 gap-2 rounded-none border-0 bg-transparent p-0 sm:justify-end">
            <Button
              variant="outline"
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
