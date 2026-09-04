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
import { BrandBadge } from "@/components/app/devices/brand-badge";
import { useApiClient } from "@/lib/api-client";
import type { Device } from "@/lib/types";

const BRANDS: Device["brand"][] = ["kindle", "kobo", "tolino", "pocketbook", "other"];
const TIER_VALUES: Device["delivery_tier"][] = ["A", "B", "C", "D"];
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
  const [brand, setBrand] = useState<Device["brand"]>("kindle");
  const [model, setModel] = useState("");
  const [tier, setTier] = useState<Device["delivery_tier"]>("A");
  const [submitting, setSubmitting] = useState(false);

  const modelOptions =
    brand !== "other" && (MODEL_BRANDS as readonly string[]).includes(brand)
      ? (t.raw(`models.${brand}`) as string[])
      : null;

  function handleBrandChange(value: Device["brand"]) {
    setBrand(value);
    setModel("");
  }

  async function submit() {
    setSubmitting(true);
    try {
      const device = await call<Device>("/api/v1/devices", {
        method: "POST",
        body: JSON.stringify({ brand, model: model || null, delivery_tier: tier }),
      });
      onCreated(device);
      toast.success(t("toastCreated"));
      onOpenChange(false);
      setModel("");
    } catch {
      toast.error(t("toastFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("brand")}</Label>
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
            <Label>{t("modelOptional")}</Label>
            {modelOptions ? (
              <Select value={model} onValueChange={(value) => setModel(value ?? "")}>
                <SelectTrigger className="w-full">
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
              <Input value={model} onChange={(event) => setModel(event.target.value)} />
            )}
          </div>
          <div className="space-y-2">
            <Label>{t("deliveryMode")}</Label>
            <Select
              value={tier}
              onValueChange={(value) => value && setTier(value as Device["delivery_tier"])}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIER_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`tierOptions.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            {tCommon("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
