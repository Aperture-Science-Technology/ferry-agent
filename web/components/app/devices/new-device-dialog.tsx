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
import type { ConversionPreset, Device, DeviceCreate } from "@/lib/types";

const BRANDS: Device["brand"][] = ["kindle", "kobo", "tolino", "pocketbook", "other"];
const MODEL_BRANDS = ["kindle", "kobo", "tolino", "pocketbook"] as const;

export function NewDeviceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (device: Device) => void;
}) {
  const t = useTranslations("newDevice");
  const tCommon = useTranslations("common");
  const { call } = useApiClient();
  const nameId = useId();
  const brandId = useId();
  const modelId = useId();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState<Device["brand"]>("kindle");
  const [model, setModel] = useState("");
  const [conversionProfile, setConversionProfile] = useState<ConversionPreset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const modelOptions =
    brand !== "other" && (MODEL_BRANDS as readonly string[]).includes(brand)
      ? (t.raw(`models.${brand}`) as string[])
      : null;

  function handleBrandChange(value: Device["brand"]) {
    setBrand(value);
    setModel("");
  }

  function handleOpenChange(next: boolean) {
    if (submitting) return;
    onOpenChange(next);
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload: DeviceCreate = {
        name: name || null,
        brand,
        model: model || null,
        conversion_profile: conversionProfile,
      };
      const device = await call<Device>("/api/v1/devices", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onCreated(device);
      toast.success(t("toastCreated"));
      onOpenChange(false);
      setName("");
      setModel("");
      setConversionProfile(null);
    } catch {
      toast.error(t("toastFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription className="break-words whitespace-normal">
            {t("description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={nameId}>{t("nameOptional")}</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("namePlaceholder")}
              disabled={submitting}
              className="min-w-0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={brandId}>{t("brand")}</Label>
            <Select
              value={brand}
              onValueChange={(value) =>
                value && handleBrandChange(value as Device["brand"])
              }
              disabled={submitting}
            >
              <SelectTrigger id={brandId} className="w-full min-w-0">
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
            <Label htmlFor={modelId}>{t("modelOptional")}</Label>
            {modelOptions ? (
              <Select
                value={model}
                onValueChange={(value) => setModel(value ?? "")}
                disabled={submitting}
              >
                <SelectTrigger id={modelId} className="w-full">
                  <SelectValue placeholder={t("modelPlaceholder")} />
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
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
            className="whitespace-normal"
          >
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={submitting}
            className="whitespace-normal"
          >
            {submitting ? <Loader2 className="animate-spin" /> : null}
            {tCommon("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
