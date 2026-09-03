"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import type { Device } from "@/lib/types";

const BRANDS: Device["brand"][] = ["kindle", "kobo", "tolino", "pocketbook", "other"];
const TIERS: { value: Device["delivery_tier"]; label: string }[] = [
  { value: "A", label: "A — Email (Send-to-Kindle)" },
  { value: "B", label: "B — Cloud (Dropbox/Drive)" },
  { value: "C", label: "C — Code navigateur" },
  { value: "D", label: "D — USB" },
];

export function NewDeviceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (device: Device) => void;
}) {
  const { call } = useApiClient();
  const [brand, setBrand] = useState<Device["brand"]>("kindle");
  const [model, setModel] = useState("");
  const [tier, setTier] = useState<Device["delivery_tier"]>("A");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const device = await call<Device>("/api/v1/devices", {
        method: "POST",
        body: JSON.stringify({ brand, model: model || null, delivery_tier: tier }),
      });
      onCreated(device);
      toast.success("Appareil ajouté.");
      onOpenChange(false);
      setModel("");
    } catch {
      toast.error(
        "Impossible de créer l'appareil (POST /api/v1/devices n'est pas encore disponible côté core)."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvel appareil</DialogTitle>
          <DialogDescription>
            Renseignez la marque et le tier de livraison de votre liseuse.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Marque</Label>
            <Select
              value={brand}
              onValueChange={(value) => value && setBrand(value as Device["brand"])}
            >
              <SelectTrigger className="w-full capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRANDS.map((value) => (
                  <SelectItem key={value} value={value} className="capitalize">
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Modèle (optionnel)</Label>
            <Input value={model} onChange={(event) => setModel(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tier de livraison</Label>
            <Select
              value={tier}
              onValueChange={(value) => value && setTier(value as Device["delivery_tier"])}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIERS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
