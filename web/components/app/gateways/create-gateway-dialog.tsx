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
import { copyTextToClipboard } from "@/components/app/gateways/gateways-state";
import { useApiClient } from "@/lib/api-client";
import type { Gateway, GatewayCredentials } from "@/lib/types";

function CopyField({ label, value }: { label: string; value: string }) {
  const t = useTranslations("createAccess");
  const tCommon = useTranslations("common");

  async function handleCopy() {
    const ok = await copyTextToClipboard(value);
    if (ok) {
      toast.success(tCommon("copied"));
    } else {
      toast.error(tCommon("copyFailed"));
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          readOnly
          value={value}
          className="font-mono text-xs break-all"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("copyAction")}
          onClick={() => void handleCopy()}
        >
          <Copy />
        </Button>
      </div>
    </div>
  );
}

function bothSecretsBlock(credentials: GatewayCredentials): string {
  return `PAIRING_TOKEN=${credentials.pairing_token}\nGATEWAY_KEY=${credentials.gateway_key}`;
}

export function GatewayCredentialsPanel({
  credentials,
}: {
  credentials: GatewayCredentials;
}) {
  const t = useTranslations("createAccess");
  const tCommon = useTranslations("common");
  const block = bothSecretsBlock(credentials);

  async function handleCopyBoth() {
    const ok = await copyTextToClipboard(block);
    if (ok) {
      toast.success(tCommon("copied"));
    } else {
      toast.error(tCommon("copyFailed"));
    }
  }

  return (
    <div className="space-y-4">
      <CopyField label={t("pairingToken")} value={credentials.pairing_token} />
      <CopyField label={t("gatewayKey")} value={credentials.gateway_key} />
      <div className="space-y-2">
        <Label>{t("bothSecrets")}</Label>
        <p className="text-sm text-muted-foreground">{t("bothSecretsHint")}</p>
        <div className="flex gap-2">
          <pre
            tabIndex={0}
            className="max-h-28 flex-1 overflow-auto rounded-md border border-border/60 bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap break-all select-all"
          >
            {block}
          </pre>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            aria-label={t("copyBothAction")}
            onClick={() => void handleCopyBoth()}
          >
            <Copy />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("copyFallbackHint")}</p>
      </div>
    </div>
  );
}

export function gatewayFromCredentials(
  credentials: GatewayCredentials,
  name: string
): Gateway {
  const ttlMinutes = credentials.pairing_token_ttl_minutes ?? 15;
  return {
    gateway_id: credentials.gateway_id,
    name,
    status: "pending",
    last_seen_at: null,
    pairing_expires_at:
      credentials.pairing_expires_at ??
      new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
    pairing_token_ttl_minutes: ttlMinutes,
    gateway_online_seconds: credentials.gateway_online_seconds ?? 60,
  };
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

  function resetForm() {
    setCredentials(null);
    setName("");
    setSubmitting(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (submitting) return;
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  async function submit() {
    if (submitting || !displayName.trim()) return;
    setSubmitting(true);
    try {
      const created = await call<GatewayCredentials>("/api/v1/gateways", {
        method: "POST",
        body: JSON.stringify({ name: displayName }),
      });
      setCredentials(created);
      onCreated(gatewayFromCredentials(created, displayName));
    } catch {
      toast.error(t("toastFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      disablePointerDismissal={submitting}
    >
      <DialogContent showCloseButton={!submitting || credentials !== null}>
        {credentials ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("createdTitle")}</DialogTitle>
              <DialogDescription>{t("createdDescription")}</DialogDescription>
            </DialogHeader>
            <GatewayCredentialsPanel credentials={credentials} />
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>{tCommon("done")}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="create-access-name">{t("name")}</Label>
              <Input
                id="create-access-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("defaultName")}
                disabled={submitting}
                autoComplete="off"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submit();
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
                autoFocus
              >
                {tCommon("cancel")}
              </Button>
              <Button onClick={() => void submit()} disabled={submitting || !displayName.trim()}>
                {submitting ? <Loader2 className="animate-spin" /> : null}
                {tCommon("create")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
