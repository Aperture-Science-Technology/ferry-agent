"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, useApiClient } from "@/lib/api-client";
import type { Device, DeliveryJob, DeliveryMethod, LibraryItem, MethodAvailability } from "@/lib/types";

const FORMATS = ["epub", "mobi", "azw3", "pdf"] as const;

/** Pen Form/Field control — surface-2, radius-md, ferry-border, padding 12, 14/500. */
const deliverFieldControlClass =
  "h-auto min-h-10 w-full rounded-md border border-border-strong bg-ferry-surface-2 px-3 py-3 text-sm font-medium";

const deliverFieldLabelClass = "text-xs font-medium text-muted-foreground";

/** Modes de livraison disponibles pour `deviceId` (voir
 * GET /api/v1/devices/{id}/methods). Le parent doit la remonter avec
 * `key={deviceId}` pour que le changement d'appareil reinitialise
 * naturellement son etat (pas de reset manuel dans un effet). */
function DeliveryMethodField({
  deviceId,
  value,
  onChange,
}: {
  deviceId: string;
  value: DeliveryMethod | "";
  onChange: (method: DeliveryMethod) => void;
}) {
  const t = useTranslations("deliverDialog");
  const { call } = useApiClient();
  const [methods, setMethods] = useState<MethodAvailability[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    call<MethodAvailability[]>(`/api/v1/devices/${deviceId}/methods`)
      .then((result) => {
        if (cancelled) return;
        setMethods(result);
        const available = result.filter((entry) => entry.available);
        if (available.length === 1) {
          onChange(available[0].method);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [deviceId, call, onChange]);

  if (failed) {
    return <p className="text-sm text-destructive">{t("methodLoadFailed")}</p>;
  }

  if (methods === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="animate-spin" />
        {t("methodLoading")}
      </div>
    );
  }

  const availableMethods = methods.filter((entry) => entry.available);

  if (availableMethods.length === 0) {
    const unavailableReasons = Array.from(
      new Set(methods.filter((entry) => entry.reason_code).map((entry) => entry.reason_code as string))
    );
    return (
      <p className="text-sm text-muted-foreground">
        {unavailableReasons.length > 0
          ? unavailableReasons.map((reason) => t(`methodUnavailable.${reason}`)).join(" ")
          : t("noMethodsAvailable")}
      </p>
    );
  }

  if (availableMethods.length === 1) {
    return <Badge variant="secondary">{t(`methods.${availableMethods[0].method}`)}</Badge>;
  }

  return (
    <Select value={value} onValueChange={(next) => next && onChange(next as DeliveryMethod)}>
      <SelectTrigger className={deliverFieldControlClass}>
        <SelectValue placeholder={t("methodPlaceholder")} />
      </SelectTrigger>
      <SelectContent>
        {availableMethods.map((entry) => (
          <SelectItem key={entry.method} value={entry.method}>
            {t(`methods.${entry.method}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DeliverDialog({
  item,
  devices,
  onOpenChange,
  onDelivered,
}: {
  item: LibraryItem | null;
  devices: Device[];
  onOpenChange: (open: boolean) => void;
  onDelivered?: (job: DeliveryJob) => void;
}) {
  const t = useTranslations("deliverDialog");
  const tCommon = useTranslations("common");
  const { call } = useApiClient();
  const [deviceId, setDeviceId] = useState<string>("");
  const [format, setFormat] = useState<string>("epub");
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState<DeliveryMethod | "">("");

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    call<{ default_format: string }>("/api/v1/users/me")
      .then((user) => {
        if (cancelled) return;
        const next = user.default_format;
        setFormat(FORMATS.includes(next as (typeof FORMATS)[number]) ? next : "epub");
      })
      .catch(() => {
        if (!cancelled) setFormat("epub");
      });
    return () => {
      cancelled = true;
    };
  }, [item, call]);

  function handleDeviceChange(value: string) {
    setDeviceId(value);
    setMethod("");
  }

  async function submit() {
    if (!item || !deviceId || !method) return;
    setSubmitting(true);
    try {
      const job = await call<DeliveryJob>("/api/v1/deliveries", {
        method: "POST",
        body: JSON.stringify({
          library_item_id: item.id,
          device_id: deviceId,
          format,
          method,
        }),
      });
      if (job.download_url) {
        toast.success(t("toastReady"), {
          description: job.download_url,
        });
      } else {
        toast.success(t("toastStarted", { status: job.status }));
      }
      onDelivered?.(job);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        toast.error(error.message);
      } else {
        toast.error(t("toastFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="min-w-0">
          <DialogTitle className="break-words whitespace-normal">
            {t("title", { title: item?.title ?? "" })}
          </DialogTitle>
          <DialogDescription className="whitespace-normal">
            {t("description")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deliver-device" className={deliverFieldLabelClass}>
              {t("device")}
            </Label>
            <Select value={deviceId} onValueChange={(value) => handleDeviceChange(value ?? "")}>
              <SelectTrigger id="deliver-device" className={`${deliverFieldControlClass} min-w-0`}>
                <SelectValue placeholder={t("devicePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {devices.length === 0 && (
                  <div className="px-3 py-2 text-sm whitespace-normal text-muted-foreground">
                    {t("noDevices")}
                  </div>
                )}
                {devices.map((device) => (
                  <SelectItem key={device.id} value={device.id} className="whitespace-normal">
                    {device.name || `${device.brand} — ${device.model}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {deviceId && (
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label className={deliverFieldLabelClass}>{t("methodLabel")}</Label>
              <DeliveryMethodField key={deviceId} deviceId={deviceId} value={method} onChange={setMethod} />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deliver-format" className={deliverFieldLabelClass}>
              {t("formatOptional")}
            </Label>
            <Select value={format} onValueChange={(value) => value && setFormat(value)}>
              <SelectTrigger id="deliver-format" className={deliverFieldControlClass}>
                <SelectValue placeholder={t("formatPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`formats.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={submit} disabled={!deviceId || !method || submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
