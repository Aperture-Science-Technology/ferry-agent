"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  GatewayFormField,
  gatewayFormControlClass,
  gatewayFormLabelClass,
} from "@/components/app/gateways/gateway-form-field";
import { copyTextToClipboard } from "@/components/app/gateways/gateways-state";
import { useApiClient } from "@/lib/api-client";
import type { Gateway, GatewayCredentials } from "@/lib/types";
import { Label } from "@/components/ui/label";

/** Pen Dialog/GatewayCredentials value box — input fill, radius-md, padding [12,14]. */
const credentialsValueBoxClass =
  "flex min-w-0 items-center gap-2 rounded-md border border-input-border bg-input px-3.5 py-3";

function CopyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
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
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId} className={gatewayFormLabelClass}>
        {label}
      </Label>
      <div className={credentialsValueBoxClass}>
        <Input
          id={fieldId}
          readOnly
          value={value}
          className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-[13px] font-semibold shadow-none focus-visible:ring-0"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-3.5 shrink-0 p-0"
          aria-label={t("copyAction")}
          onClick={() => void handleCopy()}
        >
          <Copy className="size-3.5" />
        </Button>
      </div>
      {hint ? (
        <p className="text-[11px] font-medium break-words whitespace-normal text-muted-foreground">
          {hint}
        </p>
      ) : null}
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
  const ttlMinutes = credentials.pairing_token_ttl_minutes ?? 15;

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
      <Badge variant="secondary" className="w-fit" data-credentials-ttl>
        {t("ttlBadge", { minutes: ttlMinutes })}
      </Badge>
      <CopyField
        label={t("gatewayId")}
        value={credentials.gateway_id}
        hint={t("gatewayIdHint")}
      />
      <CopyField
        label={t("pairingToken")}
        value={credentials.pairing_token}
        hint={t("pairingTokenHint")}
      />
      <CopyField
        label={t("gatewayKey")}
        value={credentials.gateway_key}
        hint={t("gatewayKeyHint")}
      />
      <div className="flex flex-col gap-1.5">
        <p className={`${gatewayFormLabelClass} break-words whitespace-normal`}>
          {t("bothSecrets")}
        </p>
        <p className="text-[11px] font-medium break-words whitespace-normal text-muted-foreground">
          {t("bothSecretsHint")}
        </p>
        <div className={credentialsValueBoxClass}>
          <pre
            tabIndex={0}
            data-both-secrets
            className="max-h-28 min-w-0 flex-1 overflow-auto font-mono text-[13px] font-semibold break-all whitespace-pre-wrap select-all"
          >
            {block}
          </pre>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-3.5 shrink-0 self-start p-0"
            aria-label={t("copyBothAction")}
            onClick={() => void handleCopyBoth()}
          >
            <Copy className="size-3.5" />
          </Button>
        </div>
        <p className="text-[11px] font-medium break-words whitespace-normal text-muted-foreground">
          {t("copyFallbackHint")}
        </p>
      </div>
      <div
        className="flex flex-col gap-2 rounded-md bg-muted p-3.5"
        data-credentials-next-steps
      >
        <p className="text-[13px] font-semibold break-words whitespace-normal">
          {t("nextStepsTitle")}
        </p>
        <p className="text-xs font-medium break-words whitespace-normal">
          {t("nextSteps1")}
        </p>
        <p className="text-xs font-medium break-words whitespace-normal">
          {t("nextSteps2")}
        </p>
        <p className="text-xs font-medium break-words whitespace-normal">
          {t("nextSteps3")}
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
        className={
          credentials
            ? "max-h-[min(90dvh,40rem)] overflow-y-auto bg-popover p-7 sm:max-w-[500px]"
            : "max-h-[min(90dvh,40rem)] overflow-y-auto"
        }
      >
        {credentials ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-[22px] font-bold tracking-tight break-words whitespace-normal">
                {t("createdTitle")}
              </DialogTitle>
              <DialogDescription className="break-words whitespace-normal">
                {t("createdDescription")}
              </DialogDescription>
            </DialogHeader>
            <GatewayCredentialsPanel credentials={credentials} />
            <DialogFooter>
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
            <DialogHeader>
              <DialogTitle className="break-words whitespace-normal">
                {t("title")}
              </DialogTitle>
              <DialogDescription className="break-words whitespace-normal">
                {t("description")}
              </DialogDescription>
            </DialogHeader>
            <GatewayFormField label={t("name")} htmlFor={nameId}>
              <Input
                id={nameId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("defaultName")}
                disabled={submitting}
                autoComplete="off"
                className={gatewayFormControlClass}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submit();
                  }
                }}
              />
            </GatewayFormField>
            <DialogFooter>
              <Button
                variant="ghost"
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
