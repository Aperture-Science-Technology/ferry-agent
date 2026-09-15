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
  deviceDisplayName,
} from "@/components/app/devices/devices-state";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { useApiClient } from "@/lib/api-client";
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
      className={
        muted
          ? "flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
          : "flex min-w-0 flex-wrap items-center gap-1.5 text-sm"
      }
    >
      <BrandBadge brand={device.brand} className="min-w-0" />
      {device.model ? (
        <span className="min-w-0 truncate">— {device.model}</span>
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
  if (!device.cloud_linked) {
    return <span className="text-muted-foreground">{notLinked}</span>;
  }
  const label =
    device.cloud_provider === "dropbox"
      ? linkedDropbox
      : device.cloud_provider === "drive"
        ? linkedDrive
        : linked;
  return (
    <Badge variant="outline" className="max-w-full gap-1">
      <Check className="size-3 shrink-0" />
      <span className="truncate">{label}</span>
    </Badge>
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
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button size="sm" variant="outline" onClick={onEdit} disabled={disabled}>
        <Pencil />
        {editLabel}
      </Button>
      {device.delivery_tier === "B" ? (
        <Button size="sm" variant="outline" onClick={onLink} disabled={disabled}>
          <Link2 />
          {linkLabel}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="destructive"
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
        let keptEmpty = true;
        setDevices((prev) => {
          const outcome = applyDeviceFetchResult(prev, null);
          keptEmpty = outcome.items.length === 0;
          return outcome.items;
        });
        if (keptEmpty) setUnavailable(true);
        else setRefreshError(true);
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

  const createAction = (
    <Button onClick={() => setCreateOpen(true)}>
      <Plus />
      {t("newDevice")}
    </Button>
  );

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void refresh()}
        disabled={refreshing}
        aria-busy={refreshing}
      >
        {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        {t("refresh")}
      </Button>
      {createAction}
    </div>
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

        {refreshError && devices.length > 0 ? (
          <Alert className="mb-4" role="status">
            <AlertTitle>{t("refreshFailedTitle")}</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{t("refreshFailedDescription")}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refresh()}
                disabled={refreshing}
              >
                {refreshing ? <Loader2 className="animate-spin" /> : null}
                {t("retry")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {unavailable && devices.length === 0 ? (
          <Alert role="alert">
            <Tablet />
            <AlertTitle>{t("unavailableTitle")}</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{t("emptyUnavailable")}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refresh()}
                disabled={refreshing}
              >
                {refreshing ? <Loader2 className="animate-spin" /> : null}
                {t("retry")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : devices.length === 0 ? (
          <EmptyState
            icon={Tablet}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={createAction}
          />
        ) : (
          <div aria-busy={refreshing}>
            <RevealGroup className="grid gap-3 lg:hidden">
              {devices.map((device) => (
                <RevealItem key={device.id}>
                  <Card size="sm" className="bg-card/60">
                    <CardContent className="space-y-3">
                      <div className="min-w-0 space-y-1">
                        {device.name ? (
                          <>
                            <CardTitle className="line-clamp-2 text-sm break-words">
                              {device.name}
                            </CardTitle>
                            <CardDescription className="min-w-0">
                              <DeviceIdentity device={device} />
                            </CardDescription>
                          </>
                        ) : (
                          <CardTitle className="text-sm font-medium">
                            <DeviceIdentity device={device} muted={false} />
                          </CardTitle>
                        )}
                      </div>

                      <p className="line-clamp-2 text-xs text-muted-foreground break-words">
                        {conversionProfileLabel(
                          device.conversion_profile,
                          tEditDevice
                        )}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="max-w-full">
                          <span className="truncate">
                            {t(`tiers.${device.delivery_tier}`)}
                          </span>
                        </Badge>
                        <CloudStatus
                          device={device}
                          linkedDropbox={t("linkedDropbox")}
                          linkedDrive={t("linkedDrive")}
                          linked={t("linked")}
                          notLinked={t("notLinked")}
                        />
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {device.last_synced_at
                          ? formatAppDate(device.last_synced_at, locale)
                          : tCommon("never")}
                      </p>

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
                    </CardContent>
                  </Card>
                </RevealItem>
              ))}
            </RevealGroup>

            <Reveal className="hidden overflow-hidden rounded-xl border border-border/60 lg:block">
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
                    <TableRow key={device.id}>
                      <TableCell className="font-medium">
                        <div className="min-w-0 space-y-1">
                          {device.name ? (
                            <span className="line-clamp-2 break-words">
                              {device.name}
                            </span>
                          ) : null}
                          <DeviceIdentity
                            device={device}
                            muted={Boolean(device.name)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="max-w-48">
                        <span className="line-clamp-2 text-sm text-muted-foreground break-words">
                          {conversionProfileLabel(
                            device.conversion_profile,
                            tEditDevice
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="max-w-48">
                          <span className="truncate">
                            {t(`tiers.${device.delivery_tier}`)}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <CloudStatus
                          device={device}
                          linkedDropbox={t("linkedDropbox")}
                          linkedDrive={t("linkedDrive")}
                          linked={t("linked")}
                          notLinked={t("notLinked")}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {device.last_synced_at
                          ? formatAppDate(device.last_synced_at, locale)
                          : tCommon("never")}
                      </TableCell>
                      <TableCell className="text-right">
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
            <DialogDescription>
              {t("deleteConfirmDescriptionNamed", { name: deleteName })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              autoFocus
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleting}
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
