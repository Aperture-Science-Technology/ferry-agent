"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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

const CLOUD_LINK_MESSAGE = "ferry-cloud-link";

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
  const locale = useLocale();
  const { call } = useApiClient();
  const [provider, setProvider] = useState<Provider>("dropbox");
  const [waiting, setWaiting] = useState(false);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const pollCancelled = useRef(false);
  const waitingDeviceId = useRef<string | null>(null);

  const resetKey = `${device?.id ?? ""}:${provider}`;
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setWaiting(false);
    pollCancelled.current = true;
    waitingDeviceId.current = null;
  }

  useEffect(() => {
    return () => {
      pollCancelled.current = true;
    };
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== CLOUD_LINK_MESSAGE) return;
      if (!waitingDeviceId.current) return;

      const deviceId = waitingDeviceId.current;
      pollCancelled.current = true;

      if (data.status === "ok") {
        void call<Device>(`/api/v1/devices/${deviceId}`)
          .then((updated) => {
            onLinked(updated);
            toast.success(t("toastLinked"));
            onOpenChange(false);
            setWaiting(false);
            waitingDeviceId.current = null;
          })
          .catch(() => {
            toast.error(t("toastFailed"));
            setWaiting(false);
            waitingDeviceId.current = null;
          });
        return;
      }

      toast.error(t("toastFailed"));
      setWaiting(false);
      waitingDeviceId.current = null;
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [call, onLinked, onOpenChange, t]);

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
    waitingDeviceId.current = device.id;
    try {
      const { url } = await call<{ url: string }>(
        `/api/v1/devices/${device.id}/link?provider=${provider}&locale=${encodeURIComponent(locale)}`
      );
      // Pas de noopener/noreferrer : le callback doit pouvoir postMessage
      // vers window.opener pour arreter le polling sans attendre 5 min.
      window.open(url, "_blank");
      setWaiting(true);
      setLoadingUrl(false);
      const linked = await pollUntilLinked(device.id);
      if (pollCancelled.current) return;
      if (linked) {
        waitingDeviceId.current = null;
        pollCancelled.current = true;
        onLinked(linked);
        toast.success(t("toastLinked"));
        onOpenChange(false);
      } else {
        toast.error(t("toastFailed"));
        setWaiting(false);
        waitingDeviceId.current = null;
      }
    } catch {
      toast.error(
        t("toastNotConfigured", {
          provider: provider === "dropbox" ? "Dropbox" : "Google Drive",
        })
      );
      setWaiting(false);
      setLoadingUrl(false);
      waitingDeviceId.current = null;
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      pollCancelled.current = true;
      setWaiting(false);
      waitingDeviceId.current = null;
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
