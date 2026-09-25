"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Tablet,
  Plus,
  Trash2,
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
import {
  DeviceEmpty,
  DeviceFeedback,
} from "@/components/app/devices/device-feedback";
import {
  DeviceActions,
  DeviceCloudState,
  DeviceIdentity,
  DeviceMetaLine,
  DeviceRow,
} from "@/components/app/devices/device-row";
import { NewDeviceDialog } from "@/components/app/devices/new-device-dialog";
import { EditDeviceDialog } from "@/components/app/devices/edit-device-dialog";
import { CloudLinkDialog } from "@/components/app/devices/cloud-link-dialog";
import { conversionProfileLabel } from "@/components/app/devices/conversion-profile-field";
import {
  applyDeviceFetchResult,
  cloudLinkPresentation,
  deviceDisplayName,
} from "@/components/app/devices/devices-state";
import { PageHeader } from "@/components/app/page-header";
import { Reveal } from "@/components/motion/reveal";
import { useApiClient } from "@/lib/api-client";
import type { Device } from "@/lib/types";

const CLOUD_LINK_MESSAGE = "ferry-cloud-link";

function formatAppDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
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

  function displayName(device: Device) {
    return deviceDisplayName(device, brandLabel(device.brand));
  }

  /** First registered device stands in as default — API has no is_default field. */
  const defaultDevice = devices.length > 0 ? devices[0]! : null;

  const headerActions = (
    <>
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
      <Button
        onClick={() => setCreateOpen(true)}
        className="min-w-0 whitespace-normal"
      >
        <Plus />
        {t("newDevice")}
      </Button>
    </>
  );

  const createAction = (
    <Button
      onClick={() => setCreateOpen(true)}
      className="min-w-0 whitespace-normal"
    >
      <Plus />
      {t("newDevice")}
    </Button>
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

  const rows = (
    <Reveal>
      <ul
        aria-busy={refreshing}
        aria-label={t("registeredTitle")}
        data-testid="devices-rows"
        className="flex min-w-0 flex-col"
      >
        {devices.map((device) => {
          const hasCustomName = Boolean(device.name?.trim());
          const name = displayName(device);
          const delivery = t(`tiers.${device.delivery_tier}`);
          const profile = conversionProfileLabel(
            device.conversion_profile,
            tEditDevice
          );
          return (
            <li key={device.id}>
              <DeviceRow
                device={device}
                ariaLabel={name}
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
                  <DeviceCloudState
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
                    editAria={t("editAria", { name })}
                    disabled={deleting}
                  />
                }
              />
            </li>
          );
        })}
      </ul>
    </Reveal>
  );

  const listBody =
    devices.length === 0 ? (
      <DeviceEmpty
        icon={Tablet}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={createAction}
      />
    ) : (
      rows
    );

  return (
    <div
      className="flex min-w-0 flex-col gap-5"
      data-testid="devices-pen-layout"
    >
      <PageHeader
        title={title}
        description={description}
        action={headerActions}
      />

      {oauthPresentation === "error" ? (
        <DeviceFeedback
          role="status"
          data-cloud-link="error"
          title={t("cloudLinkFailedTitle")}
          description={t("cloudLinkFailedDescription")}
          className="flex-col items-stretch sm:flex-row sm:items-center"
        />
      ) : null}

      {refreshError && devices.length > 0 ? (
        <DeviceFeedback
          role="status"
          title={t("refreshFailedTitle")}
          description={t("refreshFailedDescription")}
          action={retryButton}
          className="flex-col items-stretch sm:flex-row sm:items-center"
        />
      ) : null}

      {unavailable && devices.length === 0 ? (
        <DeviceEmpty
          role="alert"
          icon={Tablet}
          title={t("unavailableTitle")}
          description={t("emptyUnavailable")}
          action={retryButton}
        />
      ) : (
        <>
          {defaultDevice ? (
            <DeviceFeedback
              icon={Tablet}
              title={t("defaultDestination", {
                name: displayName(defaultDevice),
              })}
              description={t("defaultDestinationHint")}
              data-testid="devices-default-dest"
            />
          ) : null}

          <section
            data-testid="devices-panel"
            aria-label={t("registeredTitle")}
            className="flex flex-col gap-1 rounded-lg border border-border-strong bg-ferry-surface px-5 py-2"
          >
            <div className="flex items-center justify-between py-3">
              <h2 className="text-base font-medium text-foreground">
                {t("registeredTitle")}
              </h2>
              <p className="text-xs font-medium text-muted-foreground">
                {t("registeredCount", { count: devices.length })}
              </p>
            </div>

            <div data-testid="devices-body">{listBody}</div>
          </section>
        </>
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
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {t("deleteConfirmTitle")}
            </DialogTitle>
            <DialogDescription className="break-words whitespace-normal">
              {t("deleteConfirmDescriptionNamed", { name: deleteName })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
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
