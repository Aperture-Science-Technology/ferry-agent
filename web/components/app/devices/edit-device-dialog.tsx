"use client";

import { useEffect, useState } from "react";
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
import { BrandBadge } from "@/components/app/devices/brand-badge";
import { useApiClient } from "@/lib/api-client";
import type { Device } from "@/lib/types";

const BRANDS: Device["brand"][] = ["kindle", "kobo", "tolino", "pocketbook", "other"];
const MODEL_BRANDS = ["kindle", "kobo", "tolino", "pocketbook"] as const;

export function EditDeviceDialog({
  device,
  onOpenChange,
  onUpdated,
}: {
  device: Device | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: (device: Device) => void;
}) {
  const t = useTranslations("editDevice");
  const tNewDevice = useTranslations("newDevice");
  const tCommon = useTranslations("common");
  const { call } = useApiClient();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState<Device["brand"]>("kindle");
  const [model, setModel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (device) {
      setName(device.name ?? "");
      setBrand(device.brand);
      setModel(device.model ?? "");
    }
  }, [device]);

  const modelOptions =
    brand !== "other" && (MODEL_BRANDS as readonly string[]).includes(brand)
      ? (tNewDevice.raw(`models.${brand}`) as string[])
      : null;

  function handleBrandChange(value: Device["brand"]) {
    setBrand(value);
    setModel("");
  }

  async function submit() {
    if (!device) return;
    setSubmitting(true);
    try {
      const updated = await call<Device>(`/api/v1/devices/${device.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name || null, brand, model: model || null }),
      });
      onUpdated(updated);
      toast.success(t("toastUpdated"));
      onOpenChange(false);
    } catch {
      toast.error(t("toastFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={device !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{tNewDevice("nameOptional")}</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={tNewDevice("namePlaceholder")} />
          </div>
          <div className="space-y-2">
            <Label>{tNewDevice("brand")}</Label>
            <Select
              value={brand}
              onValueChange={(value) => value && handleBrandChange(value as Device["brand"])}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRANDS.map((value) => (
                  <SelectItem key={value} value={value}>
                    <BrandBadge brand={value} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{tNewDevice("modelOptional")}</Label>
            {modelOptions ? (
              <Select value={model} onValueChange={(value) => setModel(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={tNewDevice("modelPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={model} onChange={(event) => setModel(event.target.value)} />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
