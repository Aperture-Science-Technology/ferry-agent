"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Tablet,
  Plus,
  Link2,
  Check,
  Trash2,
  Pencil,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/app/empty-state";
import { SectionHeader } from "@/components/app/section-header";
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
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm",
        muted ? "text-muted-foreground" : "font-medium"
      )}
    >
      <BrandBadge brand={device.brand} className="min-w-0 max-w-full" />
      {device.model ? (
        <span className="min-w-0 max-w-full break-words whitespace-normal">
          — {device.model}
        </span>
      ) : null}
    </div>
  );
}

function CloudStatus({
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
      <span className="text-sm break-words whitespace-normal text-muted-foreground">
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
    <Badge
      variant="outline"
      className="max-w-full min-w-0 gap-1.5 overflow-hidden whitespace-normal"
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full bg-chart-2"
      />
      <Check className="size-3 shrink-0" />
      <span className="min-w-0 break-words">{label}</span>
    </Badge>
  );
}

function DeviceMetaLine({
  delivery,
  profile,
  sync,
}: {
  delivery: string;
  profile: string;
  sync: string;
}) {
  return (
    <p className="text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
      <span>{delivery}</span>
      <span className="mx-1.5 text-border" aria-hidden>
        ·
      </span>
      <span>{profile}</span>
      <span className="mx-1.5 text-border" aria-hidden>
        ·
      </span>
      <span>{sync}</span>
    </p>
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
  align = "end",
}: {
  device: Device;
  onEdit: () => void;
  onLink: () => void;
  onDelete: () => void;
  editLabel: string;
  linkLabel: string;
  deleteLabel: string;
  disabled?: boolean;
  align?: "start" | "end";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-2",
        align === "start" ? "justify-start" : "justify-end"
      )}
    >
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

export function DevicesView({
  initialDevices,
  devicesUnavailable,
  cloudLinkStatus,
}: {
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
    <div className="space-y-6">
      <Reveal>
        <SectionHeader
          title={t("sectionTitle")}
          description={
            devices.length > 0
              ? t("countLabel", { count: devices.length })
              : t("sectionDescription")
          }
          action={headerActions}
        />

        {oauthPresentation === "error" ? (
          <div
            role="status"
            data-cloud-link="error"
            className="mb-4 flex flex-col gap-3 border border-border/80 bg-accent/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
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
            className="mb-4 flex flex-col gap-3 border border-border/80 bg-accent/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
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
          <div aria-busy={refreshing}>
            <RevealGroup className="grid gap-0 divide-y divide-border/70 lg:hidden">
              {devices.map((device) => {
                const delivery = t(`tiers.${device.delivery_tier}`);
                const profile = conversionProfileLabel(
                  device.conversion_profile,
                  tEditDevice
                );
                return (
                  <RevealItem key={device.id}>
                    <article className="flex min-w-0 flex-col gap-3 py-4 first:pt-0 last:pb-0">
                      <div className="flex min-w-0 items-start gap-3">
                        <BrandBadge
                          brand={device.brand}
                          showLabel={false}
                          size="lg"
                          className="shrink-0"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          {device.name ? (
                            <>
                              <h3 className="font-heading text-[15px] leading-snug font-medium tracking-tight break-words whitespace-normal">
                                {device.name}
                              </h3>
                              <DeviceIdentity device={device} />
                            </>
                          ) : (
                            <h3 className="min-w-0 text-[15px] leading-snug font-medium">
                              <DeviceIdentity device={device} muted={false} />
                            </h3>
                          )}
                          <DeviceMetaLine
                            delivery={delivery}
                            profile={profile}
                            sync={syncLabel(device)}
                          />
                        </div>
                        <div className="max-w-[40%] min-w-0 shrink">
                          <CloudStatus
                            device={device}
                            linkedDropbox={t("linkedDropbox")}
                            linkedDrive={t("linkedDrive")}
                            linked={t("linked")}
                            notLinked={t("notLinked")}
                          />
                        </div>
                      </div>

                      <DeviceActions
                        device={device}
                        align="start"
                        onEdit={() => setEditTarget(device)}
                        onLink={() => setLinkTarget(device)}
                        onDelete={() => setDeleteTarget(device)}
                        editLabel={t("edit")}
                        linkLabel={t("linkCloud")}
                        deleteLabel={t("delete")}
                        disabled={deleting}
                      />
                    </article>
                  </RevealItem>
                );
              })}
            </RevealGroup>

            <Reveal className="hidden overflow-x-auto border-y border-border/70 lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("colDevice")}</TableHead>
                    <TableHead>{t("colProfile")}</TableHead>
                    <TableHead>{t("colDelivery")}</TableHead>
                    <TableHead>{t("colCloud")}</TableHead>
                    <TableHead>{t("colLastSync")}</TableHead>
                    <TableHead className="text-right">{t("colAction")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id} className="hover:bg-muted/20">
                      <TableCell className="max-w-56 align-top font-medium whitespace-normal">
                        <div className="flex min-w-0 items-start gap-3">
                          <BrandBadge
                            brand={device.brand}
                            showLabel={false}
                            size="lg"
                            className="shrink-0"
                          />
                          <div className="min-w-0 space-y-1">
                            {device.name ? (
                              <span className="font-heading line-clamp-2 text-sm font-medium tracking-tight break-words whitespace-normal">
                                {device.name}
                              </span>
                            ) : null}
                            <DeviceIdentity
                              device={device}
                              muted={Boolean(device.name)}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-48 align-top whitespace-normal">
                        <span className="line-clamp-2 text-sm break-words whitespace-normal text-muted-foreground">
                          {conversionProfileLabel(
                            device.conversion_profile,
                            tEditDevice
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-48 align-top whitespace-normal">
                        <span className="line-clamp-2 text-sm break-words whitespace-normal text-muted-foreground">
                          {t(`tiers.${device.delivery_tier}`)}
                        </span>
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <CloudStatus
                          device={device}
                          linkedDropbox={t("linkedDropbox")}
                          linkedDrive={t("linkedDrive")}
                          linked={t("linked")}
                          notLinked={t("notLinked")}
                        />
                      </TableCell>
                      <TableCell className="align-top text-sm whitespace-normal text-muted-foreground">
                        <span className="break-words">{syncLabel(device)}</span>
                      </TableCell>
                      <TableCell className="align-top whitespace-normal text-right">
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Reveal>
          </div>
        )}
      </Reveal>

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
            <DialogDescription className="break-words whitespace-normal">
              {t("deleteConfirmDescriptionNamed", { name: deleteName })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
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
