"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
type LinkPhase =
  | "idle"
  | "opening"
  | "waiting"
  | "popup_blocked"
  | "success_uncertain";

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
  const providerId = useId();
  const [provider, setProvider] = useState<Provider>("dropbox");
  const [phase, setPhase] = useState<LinkPhase>("idle");
  const pollCancelled = useRef(false);
  const waitingDeviceId = useRef<string | null>(null);

  const resetKey = `${device?.id ?? ""}:${provider}`;
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setPhase("idle");
  }

  useEffect(() => {
    pollCancelled.current = true;
    waitingDeviceId.current = null;
  }, [resetKey]);

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
            setPhase("idle");
            waitingDeviceId.current = null;
          })
          .catch(() => {
            setPhase("success_uncertain");
            toast.error(t("toastUncertain"));
            waitingDeviceId.current = null;
          });
        return;
      }

      toast.error(t("toastFailed"));
      setPhase("idle");
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
    setPhase("opening");
    pollCancelled.current = false;
    waitingDeviceId.current = device.id;
    try {
      const { url } = await call<{ url: string }>(
        `/api/v1/devices/${device.id}/link?provider=${provider}&locale=${encodeURIComponent(locale)}`
      );
      // Pas de noopener/noreferrer : le callback doit pouvoir postMessage
      // vers window.opener pour arreter le polling sans attendre 5 min.
      const popup = window.open(url, "_blank");
      if (!popup) {
        setPhase("popup_blocked");
        waitingDeviceId.current = null;
        return;
      }
      setPhase("waiting");
      const linked = await pollUntilLinked(device.id);
      if (pollCancelled.current) return;
      if (linked) {
        waitingDeviceId.current = null;
        pollCancelled.current = true;
        onLinked(linked);
        toast.success(t("toastLinked"));
        onOpenChange(false);
        setPhase("idle");
      } else {
        toast.error(t("toastFailed"));
        setPhase("idle");
        waitingDeviceId.current = null;
      }
    } catch {
      toast.error(
        t("toastNotConfigured", {
          provider: provider === "dropbox" ? "Dropbox" : "Google Drive",
        })
      );
      setPhase("idle");
      waitingDeviceId.current = null;
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      pollCancelled.current = true;
      setPhase("idle");
      waitingDeviceId.current = null;
    }
    onOpenChange(open);
  }

  const busy = phase === "opening" || phase === "waiting";
  const description =
    phase === "waiting"
      ? t("waitingOtherWindow")
      : phase === "opening"
        ? t("opening")
        : phase === "popup_blocked"
          ? t("popupBlockedDescription")
          : phase === "success_uncertain"
            ? t("uncertainDescription")
            : t("description");

  return (
    <Dialog open={device !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription className="break-words whitespace-normal">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {phase === "popup_blocked" ? (
            <Alert role="alert">
              <AlertTitle>{t("popupBlockedTitle")}</AlertTitle>
              <AlertDescription>{t("popupBlockedDescription")}</AlertDescription>
            </Alert>
          ) : null}
          {phase === "success_uncertain" ? (
            <Alert role="status">
              <AlertTitle>{t("uncertainTitle")}</AlertTitle>
              <AlertDescription>{t("uncertainDescription")}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={providerId}>{t("provider")}</Label>
            <Select
              value={provider}
              onValueChange={(value) => value && setProvider(value as Provider)}
              disabled={busy}
            >
              <SelectTrigger id={providerId} className="w-full">
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
            onClick={() => void startLink()}
            disabled={busy}
            className="w-full whitespace-normal"
          >
            {busy ? <Loader2 className="animate-spin" /> : <ExternalLink />}
            {phase === "waiting"
              ? t("waitingShort")
              : phase === "popup_blocked"
                ? t("reopenAuth")
                : t("openAuth")}
          </Button>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={phase === "opening"}
            className="whitespace-normal"
          >
            {tCommon("cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
