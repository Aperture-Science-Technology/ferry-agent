"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Ban, BookOpen, Copy, Loader2, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
import { CatalogQrCode } from "@/components/app/settings/catalog-qr-code";
import { formatTokenLastUsed } from "@/components/app/settings/settings-state";
import { EmptyState } from "@/components/app/empty-state";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { copyTextToClipboard } from "@/components/app/gateways/gateways-state";
import { useApiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { OpdsToken, OpdsTokenCreated } from "@/lib/types";

const fieldControlClass =
  "h-auto min-h-0 w-full rounded-md border-border bg-muted px-3 py-3 text-sm font-medium text-foreground shadow-none";

function SoftNotice({
  title,
  description,
  role = "status",
}: {
  title: string;
  description: string;
  role?: "status" | "alert";
}) {
  return (
    <div
      role={role}
      className="flex flex-col gap-1 border border-border bg-muted/40 px-4 py-3"
    >
      <p className="font-heading text-sm font-medium tracking-tight break-words whitespace-normal">
        {title}
      </p>
      <p className="text-sm leading-relaxed break-words whitespace-normal text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

/** Pen OPDS card — surface + border radius-md, title 14 + meta 12 + optional QR 96. */
function OpdsTokenCard({
  tokenId,
  title,
  meta,
  actions,
  qr,
}: {
  tokenId?: string;
  title: string;
  meta: string;
  actions?: ReactNode;
  qr?: ReactNode;
}) {
  return (
    <article
      data-testid="opds-token-card"
      data-token-id={tokenId}
      className="flex min-w-0 flex-col gap-2.5 rounded-md border border-border bg-card p-3 md:gap-2.5 md:p-4"
    >
      <h3 className="text-sm font-medium break-words whitespace-normal text-foreground">
        {title}
      </h3>
      <p className="text-xs font-medium break-words whitespace-normal text-muted-foreground">
        {meta}
      </p>
      {actions ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
      {qr}
    </article>
  );
}

export function ReaderCatalogSection({
  initialTokens,
  tokensUnavailable,
}: {
  initialTokens: OpdsToken[];
  tokensUnavailable: boolean;
}) {
  const t = useTranslations("settings.readerCatalog");
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
    <div className="min-w-0 space-y-4" data-catalog-state={catalogState}>
      <SoftNotice title={t("warningTitle")} description={t("warning")} />

      <div className="min-w-0 space-y-2">
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
        <SoftNotice
          title={t("unavailableTitle")}
          description={t("unavailable")}
          role="alert"
        />
      ) : null}

      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-sm font-medium text-foreground">
            {t("linksTitle")}
          </h3>
          {tokens.length > 0 ? (
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {t("countLabel", { count: tokens.length })}
            </p>
          ) : null}
        </div>
        {tokensUnavailable ? null : createAction}
      </div>

      {tokensUnavailable ? null : tokens.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={createAction}
        />
      ) : (
        <div data-testid="opds-token-cards">
          <RevealGroup className="flex min-w-0 flex-col gap-3">
            {tokens.map((token) => (
              <RevealItem key={token.id}>
                <OpdsTokenCard
                  tokenId={token.id}
                  title={t("tokenTitle", { label: token.label })}
                  meta={`${formatTokenLastUsed(
                    token.last_used_at,
                    locale,
                    t("neverUsed")
                  )} · ${t("actionsHintList")}`}
                  actions={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
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
        <DialogContent className="max-h-[min(90dvh,40rem)] overflow-y-auto sm:max-w-md">
          {created ? (
            <>
              <DialogHeader>
                <DialogTitle className="break-words whitespace-normal">
                  {t("createdTitle")}
                </DialogTitle>
                <DialogDescription className="break-words whitespace-normal">
                  {t("createdDescription")}
                </DialogDescription>
              </DialogHeader>
              <div className="min-w-0 space-y-4" data-catalog-created>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Label
                    htmlFor="catalog-created-url"
                    className="text-xs font-medium break-words whitespace-normal text-muted-foreground"
                  >
                    {t("urlLabel")}
                  </Label>
                  <div className="flex min-w-0 gap-2">
                    <Input
                      id="catalog-created-url"
                      readOnly
                      value={created.url}
                      className={cn(
                        fieldControlClass,
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
                  {copyFailed ? (
                    <p
                      className="text-xs leading-relaxed break-words whitespace-normal text-destructive"
                      role="alert"
                    >
                      {tCommon("copyFailed")}
                    </p>
                  ) : null}
                </div>
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
                <SoftNotice
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
              <DialogHeader>
                <DialogTitle className="break-words whitespace-normal">
                  {t("createTitle")}
                </DialogTitle>
                <DialogDescription className="break-words whitespace-normal">
                  {t("createDescription")}
                </DialogDescription>
              </DialogHeader>
              {/* Pen Form/Field */}
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label
                  htmlFor="catalog-link-label"
                  className="text-xs font-medium break-words whitespace-normal text-muted-foreground"
                >
                  {t("labelField")}
                </Label>
                <Input
                  id="catalog-link-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  onKeyDown={onCreateKeyDown}
                  placeholder={t("defaultLabel")}
                  disabled={submitting}
                  className={fieldControlClass}
                  autoComplete="off"
                />
                <p className="text-xs font-medium text-muted-foreground">
                  {t("labelHint")}
                </p>
              </div>
              {createError ? (
                <SoftNotice
                  title={t("createErrorTitle")}
                  description={createError}
                  role="alert"
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

      {/* Pen Dialog/RevokeOpds */}
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
            <SoftNotice
              title={t("revokeErrorTitle")}
              description={revokeError}
              role="alert"
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
