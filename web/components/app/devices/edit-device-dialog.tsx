"use client";

import { useId, useState } from "react";
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
import { ConversionProfileField } from "@/components/app/devices/conversion-profile-field";
import { useApiClient } from "@/lib/api-client";
import type { ConversionPreset, Device, DevicePatch } from "@/lib/types";

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
  const nameId = useId();
  const brandId = useId();
  const modelId = useId();
  const [name, setName] = useState(device?.name ?? "");
  const [brand, setBrand] = useState<Device["brand"]>(device?.brand ?? "kindle");
  const [model, setModel] = useState(device?.model ?? "");
  const [conversionProfile, setConversionProfile] = useState<ConversionPreset | null>(
    device?.conversion_profile ?? null
  );
  const [submitting, setSubmitting] = useState(false);

  const modelOptions =
    brand !== "other" && (MODEL_BRANDS as readonly string[]).includes(brand)
      ? (tNewDevice.raw(`models.${brand}`) as string[])
      : null;

  function handleBrandChange(value: Device["brand"]) {
    setBrand(value);
    setModel("");
  }

  function handleOpenChange(open: boolean) {
    if (submitting) return;
    onOpenChange(open);
  }

  async function submit() {
    if (!device || submitting) return;
    setSubmitting(true);
    try {
      const payload: DevicePatch = {
        name: name || null,
        brand,
        model: model || null,
        conversion_profile: conversionProfile,
      };
      const updated = await call<Device>(`/api/v1/devices/${device.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
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
    <Dialog open={device !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={nameId}>{tNewDevice("nameOptional")}</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={tNewDevice("namePlaceholder")}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={brandId}>{tNewDevice("brand")}</Label>
            <Select
              value={brand}
              onValueChange={(value) =>
                value && handleBrandChange(value as Device["brand"])
              }
              disabled={submitting}
            >
              <SelectTrigger id={brandId} className="w-full">
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
            <Label htmlFor={modelId}>{tNewDevice("modelOptional")}</Label>
            {modelOptions ? (
              <Select
                value={model}
                onValueChange={(value) => setModel(value ?? "")}
                disabled={submitting}
              >
                <SelectTrigger id={modelId} className="w-full">
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
              <Input
                id={modelId}
                value={model}
                onChange={(event) => setModel(event.target.value)}
                disabled={submitting}
              />
            )}
          </div>
          <ConversionProfileField
            value={conversionProfile}
            onChange={setConversionProfile}
            disabled={submitting}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            {tCommon("cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
