"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
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
import type { Device } from "@/lib/types";

type Provider = "dropbox" | "drive";

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
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const resetKey = `${device?.id ?? ""}:${provider}`;
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setAuthorizeUrl(null);
    setCode("");
  }

  async function fetchAuthorizeUrl() {
    if (!device) return;
    setLoadingUrl(true);
    try {
      const { url } = await call<{ url: string }>(
        `/api/v1/devices/${device.id}/link?provider=${provider}`
      );
      setAuthorizeUrl(url);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error(
        t("toastNotConfigured", {
          provider: provider === "dropbox" ? "Dropbox" : "Google Drive",
        })
      );
    } finally {
      setLoadingUrl(false);
    }
  }

  async function submitCode() {
    if (!device || !code.trim()) return;
    setSubmitting(true);
    try {
      const updated = await call<Device>(`/api/v1/devices/${device.id}/link/callback`, {
        method: "POST",
        body: JSON.stringify({ provider, code: code.trim() }),
      });
      onLinked(updated);
      toast.success(t("toastLinked"));
      onOpenChange(false);
    } catch {
      toast.error(t("toastCodeFailed"));
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
            <Label>{t("provider")}</Label>
            <Select
              value={provider}
              onValueChange={(value) => value && setProvider(value as Provider)}
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
          <Button variant="outline" onClick={fetchAuthorizeUrl} disabled={loadingUrl} className="w-full">
            {loadingUrl ? <Loader2 className="animate-spin" /> : <ExternalLink />}
            {t("openAuth")}
          </Button>
          {authorizeUrl && (
            <div className="space-y-2">
              <Label>{t("authCode")}</Label>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder={t("codePlaceholder")}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={submitCode} disabled={!authorizeUrl || !code.trim() || submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            {t("link")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
