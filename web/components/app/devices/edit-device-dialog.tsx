"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
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
import {
  DeviceFormField,
  deviceFormControlClass,
} from "@/components/app/devices/device-form-field";
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
      <DialogContent className="gap-4 p-6 sm:max-w-[420px]">
        <DialogHeader className="gap-2">
          <DialogTitle className="font-heading text-xl font-medium tracking-tight">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-sm font-medium break-words whitespace-normal">
            {t("description")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <DeviceFormField label={tNewDevice("nameOptional")} htmlFor={nameId}>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={tNewDevice("namePlaceholder")}
              disabled={submitting}
              className={deviceFormControlClass}
            />
          </DeviceFormField>
          <DeviceFormField label={tNewDevice("brand")} htmlFor={brandId}>
            <Select
              value={brand}
              onValueChange={(value) =>
                value && handleBrandChange(value as Device["brand"])
              }
              disabled={submitting}
            >
              <SelectTrigger id={brandId} className={deviceFormControlClass}>
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
          </DeviceFormField>
          <DeviceFormField label={tNewDevice("modelOptional")} htmlFor={modelId}>
            {modelOptions ? (
              <Select
                value={model}
                onValueChange={(value) => setModel(value ?? "")}
                disabled={submitting}
              >
                <SelectTrigger id={modelId} className={deviceFormControlClass}>
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
                className={deviceFormControlClass}
              />
            )}
          </DeviceFormField>
          <ConversionProfileField
            value={conversionProfile}
            onChange={setConversionProfile}
            disabled={submitting}
          />
        </div>
        <DialogFooter className="mx-0 mb-0 gap-2 rounded-none border-0 bg-transparent p-0 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
            className="whitespace-normal rounded-md"
          >
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={submitting}
            className="whitespace-normal rounded-md"
          >
            {submitting ? <Loader2 className="animate-spin" /> : null}
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
