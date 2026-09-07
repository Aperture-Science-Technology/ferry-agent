"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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

type Provider = "dropbox" | "drive";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export function CloudLinkDialog({
  device,
  onOpenChange,
  onLinked,
}: {
  device: Device | null;
  onOpenChange: (open: boolean) => void;
  onLinked: (device: Device) => void;
}) {
  const t = useTranslations("cloudLink");
  const tCommon = useTranslations("common");
  const { call } = useApiClient();
  const [provider, setProvider] = useState<Provider>("dropbox");
  const [waiting, setWaiting] = useState(false);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const pollCancelled = useRef(false);

  const resetKey = `${device?.id ?? ""}:${provider}`;
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setWaiting(false);
    pollCancelled.current = true;
  }

  useEffect(() => {
    return () => {
      pollCancelled.current = true;
    };
  }, []);

  async function pollUntilLinked(deviceId: string): Promise<Device | null> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (pollCancelled.current) return null;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      if (pollCancelled.current) return null;
      try {
        const updated = await call<Device>(`/api/v1/devices/${deviceId}`);
        if (updated.cloud_linked) return updated;
      } catch {
        // reseau transitoire : on continue jusqu'au timeout
      }
    }
    return null;
  }

  async function startLink() {
    if (!device) return;
    setLoadingUrl(true);
    pollCancelled.current = false;
    try {
      const { url } = await call<{ url: string }>(
        `/api/v1/devices/${device.id}/link?provider=${provider}`
      );
      window.open(url, "_blank", "noopener,noreferrer");
      setWaiting(true);
      setLoadingUrl(false);
      const linked = await pollUntilLinked(device.id);
      if (pollCancelled.current) return;
      if (linked) {
        onLinked(linked);
        toast.success(t("toastLinked"));
        onOpenChange(false);
      } else {
        toast.error(t("toastFailed"));
        setWaiting(false);
      }
    } catch {
      toast.error(
        t("toastNotConfigured", {
          provider: provider === "dropbox" ? "Dropbox" : "Google Drive",
        })
      );
      setWaiting(false);
      setLoadingUrl(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      pollCancelled.current = true;
      setWaiting(false);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={device !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {waiting ? t("waiting") : t("description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("provider")}</Label>
            <Select
              value={provider}
              onValueChange={(value) => value && setProvider(value as Provider)}
              disabled={waiting || loadingUrl}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dropbox">Dropbox</SelectItem>
                <SelectItem value="drive">Google Drive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            onClick={startLink}
            disabled={loadingUrl || waiting}
            className="w-full"
          >
            {loadingUrl || waiting ? <Loader2 className="animate-spin" /> : <ExternalLink />}
            {waiting ? t("waitingShort") : t("openAuth")}
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
