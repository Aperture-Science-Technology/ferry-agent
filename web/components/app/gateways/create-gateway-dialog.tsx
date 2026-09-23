"use client";

import { useId, useState } from "react";
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

/** Pen Form/Field lz3PJ — label 12 muted, input pad 12 radius-md surface-2. */
const fieldClass = "flex flex-col gap-1.5";
const labelClass = "text-xs font-medium text-muted-foreground";
const controlClass =
  "h-auto min-h-10 w-full rounded-lg border-border bg-ferry-surface-2 px-3 py-3 text-sm font-medium";

function CopyField({ label, value }: { label: string; value: string }) {
  const t = useTranslations("createAccess");
  const tCommon = useTranslations("common");
  const fieldId = useId();

  async function handleCopy() {
    const ok = await copyTextToClipboard(value);
    if (ok) {
      toast.success(tCommon("copied"));
    } else {
      toast.error(tCommon("copyFailed"));
    }
  }

  return (
    <div className={fieldClass}>
      <Label htmlFor={fieldId} className={`${labelClass} break-words whitespace-normal`}>
        {label}
      </Label>
      <div className="flex min-w-0 gap-2">
        <Input
          id={fieldId}
          readOnly
          value={value}
          className={`${controlClass} min-w-0 font-mono text-xs break-all`}
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          aria-label={t("copyAction")}
          onClick={() => void handleCopy()}
        >
          <Copy />
        </Button>
      </div>
    </div>
  );
}

/** Ready-to-paste block with both secrets — keep format stable for install guides. */
export function bothSecretsBlock(credentials: GatewayCredentials): string {
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
    <div className="flex min-w-0 flex-col gap-4" data-credentials-panel>
      <CopyField label={t("pairingToken")} value={credentials.pairing_token} />
      <CopyField label={t("gatewayKey")} value={credentials.gateway_key} />
      <div className={fieldClass}>
        <Label className={`${labelClass} break-words whitespace-normal`}>
          {t("bothSecrets")}
        </Label>
        <p className="text-xs font-medium break-words whitespace-normal text-muted-foreground">
          {t("bothSecretsHint")}
        </p>
        <div className="flex min-w-0 gap-2">
          <pre
            tabIndex={0}
            data-both-secrets
            className="max-h-28 min-w-0 flex-1 overflow-auto rounded-lg border border-border bg-ferry-surface-2 p-3 font-mono text-xs break-all whitespace-pre-wrap select-all"
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
        <p className="text-xs font-medium break-words whitespace-normal text-muted-foreground">
          {t("copyFallbackHint")}
        </p>
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
  const nameId = useId();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<GatewayCredentials | null>(
    null
  );

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
      <DialogContent
        showCloseButton={!submitting || credentials !== null}
        className="max-h-[min(90dvh,40rem)] gap-4 overflow-y-auto p-6 sm:max-w-[420px]"
      >
        {credentials ? (
          <>
            <DialogHeader className="gap-2">
              <DialogTitle className="font-heading text-xl font-medium tracking-tight break-words whitespace-normal">
                {t("createdTitle")}
              </DialogTitle>
              <DialogDescription className="text-sm font-medium break-words whitespace-normal">
                {t("createdDescription")}
              </DialogDescription>
            </DialogHeader>
            <GatewayCredentialsPanel credentials={credentials} />
            <DialogFooter className="mx-0 mb-0 gap-2 rounded-none border-0 bg-transparent p-0 sm:justify-end">
              <Button
                onClick={() => handleOpenChange(false)}
                className="whitespace-normal"
              >
                {tCommon("done")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="gap-2">
              <DialogTitle className="font-heading text-xl font-medium tracking-tight break-words whitespace-normal">
                {t("title")}
              </DialogTitle>
              <DialogDescription className="text-sm font-medium break-words whitespace-normal">
                {t("description")}
              </DialogDescription>
            </DialogHeader>
            <div className={fieldClass}>
              <Label
                htmlFor={nameId}
                className={`${labelClass} break-words whitespace-normal`}
              >
                {t("name")}
              </Label>
              <Input
                id={nameId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("defaultName")}
                disabled={submitting}
                autoComplete="off"
                className={controlClass}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submit();
                  }
                }}
              />
            </div>
            <DialogFooter className="mx-0 mb-0 gap-2 rounded-none border-0 bg-transparent p-0 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
                autoFocus
                className="whitespace-normal"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                onClick={() => void submit()}
                disabled={submitting || !displayName.trim()}
                className="whitespace-normal"
              >
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
