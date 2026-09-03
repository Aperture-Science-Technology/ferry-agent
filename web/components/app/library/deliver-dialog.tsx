"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { useApiClient } from "@/lib/api-client";
import type { Device, DeliveryJob, LibraryItem } from "@/lib/types";

export function DeliverDialog({
  item,
  devices,
  onOpenChange,
}: {
  item: LibraryItem | null;
  devices: Device[];
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("deliverDialog");
  const tCommon = useTranslations("common");
  const { call } = useApiClient();
  const [deviceId, setDeviceId] = useState<string>("");
  const [format, setFormat] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!item || !deviceId) return;
    setSubmitting(true);
    try {
      const job = await call<DeliveryJob>("/api/v1/deliveries", {
        method: "POST",
        body: JSON.stringify({
          library_item_id: item.id,
          device_id: deviceId,
          format: format || undefined,
        }),
      });
      if (job.download_url) {
        toast.success(t("toastReady"), {
          description: job.download_url,
        });
      } else {
        toast.success(t("toastStarted", { status: job.status }));
      }
      onOpenChange(false);
    } catch {
      toast.error(t("toastFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { title: item?.title ?? "" })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("device")}</Label>
            <Select value={deviceId} onValueChange={(value) => setDeviceId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("devicePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {devices.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {t("noDevices")}
                  </div>
                )}
                {devices.map((device) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.brand} {device.model ? `— ${device.model}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("formatOptional")}</Label>
            <Input
              value={format}
              onChange={(event) => setFormat(event.target.value)}
              placeholder={t("formatPlaceholder")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={submit} disabled={!deviceId || submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
