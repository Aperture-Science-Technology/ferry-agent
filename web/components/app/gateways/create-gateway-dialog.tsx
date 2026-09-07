"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
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
import { useApiClient } from "@/lib/api-client";
import type { Gateway, GatewayCredentials } from "@/lib/types";

function CopyField({ label, value }: { label: string; value: string }) {
  const tCommon = useTranslations("common");
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success(tCommon("copied"));
          }}
        >
          <Copy />
        </Button>
      </div>
    </div>
  );
}

export function CreateGatewayDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (gateway: Gateway) => void;
}) {
  const t = useTranslations("createAccess");
  const tCommon = useTranslations("common");
  const { call } = useApiClient();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<GatewayCredentials | null>(null);

  const displayName = name || t("defaultName");

  async function submit() {
    setSubmitting(true);
    try {
      const created = await call<GatewayCredentials>("/api/v1/gateways", {
        method: "POST",
        body: JSON.stringify({ name: displayName }),
      });
      setCredentials(created);
      const ttlMinutes = created.pairing_token_ttl_minutes ?? 15;
      onCreated({
        gateway_id: created.gateway_id,
        name: displayName,
        status: "pending",
        last_seen_at: null,
        pairing_expires_at:
          created.pairing_expires_at ??
          new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
        pairing_token_ttl_minutes: ttlMinutes,
        gateway_online_seconds: created.gateway_online_seconds ?? 60,
      });
    } catch {
      toast.error(t("toastFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  function close(nextOpen: boolean) {
    if (!nextOpen) {
      setCredentials(null);
      setName("");
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        {credentials ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("createdTitle")}</DialogTitle>
              <DialogDescription>{t("createdDescription")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <CopyField label={t("pairingToken")} value={credentials.pairing_token} />
              <CopyField label={t("gatewayKey")} value={credentials.gateway_key} />
            </div>
            <DialogFooter>
              <Button onClick={() => close(false)}>{tCommon("done")}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>{t("name")}</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("defaultName")}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                {tCommon("cancel")}
              </Button>
              <Button onClick={submit} disabled={submitting || !displayName.trim()}>
                {submitting && <Loader2 className="animate-spin" />}
                {tCommon("create")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
