"use client";

import { useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import {
  Ban,
  BookOpen,
  CircleAlert,
  Copy,
  Loader2,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
import { CatalogQrCode } from "@/components/app/settings/catalog-qr-code";
import {
  OpdsTokenCard,
  OpdsTokenStatusBadge,
} from "@/components/app/settings/opds-token-card";
import {
  SettingsEmpty,
  SettingsFeedback,
} from "@/components/app/settings/settings-feedback";
import {
  SettingsFormField,
  settingsFormControlClass,
} from "@/components/app/settings/settings-form-field";
import {
  formatTokenCreatedDate,
  formatTokenLastUsed,
} from "@/components/app/settings/settings-state";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { copyTextToClipboard } from "@/components/app/gateways/gateways-state";
import { useApiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { OpdsToken, OpdsTokenCreated } from "@/lib/types";

export function ReaderCatalogSection({
  initialTokens,
  tokensUnavailable,
}: {
  initialTokens: OpdsToken[];
  tokensUnavailable: boolean;
}) {
  const t = useTranslations("settings.readerCatalog");
  const tSettings = useTranslations("settings");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { call } = useApiClient();
  const [tokens, setTokens] = useState(initialTokens);
  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<OpdsTokenCreated | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<OpdsToken | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  const displayLabel = label.trim() || t("defaultLabel");
  const catalogState = tokensUnavailable
    ? "unavailable"
    : createError || revokeError
      ? "error"
      : tokens.length === 0
        ? "empty"
        : "ready";

  async function submit() {
    setSubmitting(true);
    setCreateError(null);
    try {
      const result = await call<OpdsTokenCreated>("/api/v1/opds/tokens", {
        method: "POST",
        body: JSON.stringify({ label: displayLabel }),
      });
      setCreated(result);
      setCopyFailed(false);
      setTokens((prev) => [
        {
          id: result.id,
          label: result.label,
          created_at: result.created_at,
          last_used_at: null,
        },
        ...prev,
      ]);
    } catch {
      setCreateError(t("toastCreateFailed"));
      toast.error(t("toastCreateFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  function closeCreate(nextOpen: boolean) {
    if (submitting) return;
    if (!nextOpen) {
      setCreated(null);
      setLabel("");
      setCreateError(null);
      setCopyFailed(false);
    }
    setCreateOpen(nextOpen);
  }

  function onCreateKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !submitting && displayLabel) {
      event.preventDefault();
      void submit();
    }
  }

  async function handleCopyUrl(url: string) {
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setCopyFailed(false);
      toast.success(tCommon("copied"));
    } else {
      setCopyFailed(true);
      toast.error(tCommon("copyFailed"));
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      await call("/api/v1/opds/tokens/revoke", {
        method: "POST",
        body: JSON.stringify({ token_id: revokeTarget.id }),
      });
      setTokens((prev) => prev.filter((row) => row.id !== revokeTarget.id));
      toast.success(t("toastRevoked"));
      setRevokeTarget(null);
    } catch {
      setRevokeError(t("toastRevokeFailed"));
      toast.error(t("toastRevokeFailed"));
    } finally {
      setRevoking(false);
    }
  }

  const createAction = (
    <Button
      type="button"
      onClick={() => setCreateOpen(true)}
      className="w-full whitespace-normal sm:w-auto"
    >
      <Plus aria-hidden />
      {t("createCta")}
    </Button>
  );

  return (
    <div
      className="flex min-w-0 flex-col gap-3"
      data-catalog-state={catalogState}
    >
      {/* Pen OPDS head — titles + Créer jeton */}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-base font-medium text-foreground">
            {tSettings("opdsTokensTitle")}
          </h2>
          <p className="text-[13px] font-medium text-muted-foreground">
            {tSettings("opdsTokensDescription")}
          </p>
        </div>
        {tokensUnavailable ? null : createAction}
      </div>

      <SettingsFeedback
        icon={CircleAlert}
        title={t("warningTitle")}
        description={t("warning")}
      />

      <div className="flex min-w-0 flex-col gap-2">
        <p className="font-heading text-sm font-medium tracking-tight break-words whitespace-normal text-foreground">
          {t("guideTitle")}
        </p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
          <li>{t("guideStep1")}</li>
          <li>{t("guideStep2")}</li>
          <li>{t("guideStep3")}</li>
          <li>{t("guideStep4")}</li>
        </ol>
      </div>

      {tokensUnavailable ? (
        <SettingsEmpty
          role="alert"
          icon={BookOpen}
          title={t("unavailableTitle")}
          description={t("unavailable")}
        />
      ) : null}

      {tokensUnavailable ? null : tokens.length === 0 ? (
        <SettingsEmpty
          icon={BookOpen}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={createAction}
        />
      ) : (
        <div
          data-testid="opds-token-cards"
          className="flex min-w-0 flex-col rounded-lg border border-border bg-card px-5 py-2"
        >
          <RevealGroup className="flex min-w-0 flex-col">
            {tokens.map((token) => (
              <RevealItem key={token.id}>
                <OpdsTokenCard
                  tokenId={token.id}
                  title={token.label}
                  badge={<OpdsTokenStatusBadge label={t("statusActive")} />}
                  meta={t("tokenMeta", {
                    created: formatTokenCreatedDate(token.created_at, locale),
                    lastUsed: formatTokenLastUsed(
                      token.last_used_at,
                      locale,
                      t("neverUsed")
                    ),
                  })}
                  actions={
                    <Button
                      type="button"
                      variant="ghost"
                      className="whitespace-normal"
                      onClick={() => {
                        setRevokeError(null);
                        setRevokeTarget(token);
                      }}
                    >
                      <Ban aria-hidden />
                      {t("revoke")}
                    </Button>
                  }
                />
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={closeCreate}
        disablePointerDismissal={submitting}
      >
        <DialogContent className="max-h-[min(90dvh,40rem)] gap-4 overflow-y-auto sm:max-w-md">
          {created ? (
            <>
              <DialogHeader className="gap-2">
                <DialogTitle className="font-heading text-lg font-medium break-words whitespace-normal">
                  {t("createdTitle")}
                </DialogTitle>
                <DialogDescription className="text-sm font-medium break-words whitespace-normal text-muted-foreground">
                  {t("createdDescription")}
                </DialogDescription>
              </DialogHeader>
              <div className="flex min-w-0 flex-col gap-4" data-catalog-created>
                <SettingsFormField
                  htmlFor="catalog-created-url"
                  label={t("urlLabel")}
                >
                  <div className="flex min-w-0 gap-2">
                    <Input
                      id="catalog-created-url"
                      readOnly
                      value={created.url}
                      className={cn(
                        settingsFormControlClass,
                        "min-w-0 flex-1 font-mono text-xs break-all"
                      )}
                      onFocus={(event) => event.currentTarget.select()}
                      data-catalog-url
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      aria-label={t("copyUrlAria")}
                      onClick={() => void handleCopyUrl(created.url)}
                    >
                      <Copy aria-hidden />
                    </Button>
                  </div>
                </SettingsFormField>
                {copyFailed ? (
                  <p
                    className="text-xs leading-relaxed break-words whitespace-normal text-destructive"
                    role="alert"
                  >
                    {tCommon("copyFailed")}
                  </p>
                ) : null}
                <div className="flex min-w-0 flex-col items-start gap-2">
                  <p className="text-xs font-medium text-muted-foreground md:hidden">
                    {t("actionsHintMobile")}
                  </p>
                  <p className="hidden text-xs font-medium text-muted-foreground md:block">
                    {t("actionsHint")}
                  </p>
                  <CatalogQrCode url={created.url} size={96} />
                  <p className="max-w-full text-xs font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
                    {t("qrHint")}
                  </p>
                </div>
                <SettingsFeedback
                  icon={CircleAlert}
                  title={t("oneTimeTitle")}
                  description={t("oneTimeWarning")}
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  onClick={() => closeCreate(false)}
                  className="whitespace-normal"
                >
                  {tCommon("done")}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader className="gap-2">
                <DialogTitle className="font-heading text-lg font-medium break-words whitespace-normal">
                  {t("createTitle")}
                </DialogTitle>
                <DialogDescription className="text-sm font-medium break-words whitespace-normal text-muted-foreground">
                  {t("createDescription")}
                </DialogDescription>
              </DialogHeader>
              <SettingsFormField
                htmlFor="catalog-link-label"
                label={t("labelField")}
                hint={t("labelHint")}
              >
                <Input
                  id="catalog-link-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  onKeyDown={onCreateKeyDown}
                  placeholder={t("defaultLabel")}
                  disabled={submitting}
                  className={settingsFormControlClass}
                  autoComplete="off"
                />
              </SettingsFormField>
              {createError ? (
                <SettingsFeedback
                  role="alert"
                  icon={TriangleAlert}
                  title={t("createErrorTitle")}
                  description={createError}
                />
              ) : null}
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => closeCreate(false)}
                  disabled={submitting}
                  autoFocus
                  className="whitespace-normal"
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={() => void submit()}
                  disabled={submitting || !displayLabel}
                  className="whitespace-normal"
                >
                  {submitting ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : null}
                  {tCommon("create")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !open && !revoking && setRevokeTarget(null)}
        disablePointerDismissal={revoking}
      >
        <DialogContent className="max-h-[min(90dvh,40rem)] gap-4 overflow-y-auto sm:max-w-[400px]">
          <DialogHeader className="gap-2">
            <DialogTitle className="font-heading text-lg font-medium break-words whitespace-normal">
              {t("revokeConfirmTitle")}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium break-words whitespace-normal text-muted-foreground">
              {t("revokeConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          {revokeError ? (
            <SettingsFeedback
              role="alert"
              icon={TriangleAlert}
              title={t("revokeErrorTitle")}
              description={revokeError}
            />
          ) : null}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevokeTarget(null)}
              disabled={revoking}
              autoFocus
              className="whitespace-normal"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmRevoke()}
              disabled={revoking}
              className="whitespace-normal"
            >
              {revoking ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Ban aria-hidden />
              )}
              {t("revoke")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
