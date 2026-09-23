"use client";

import { useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Ban, BookOpen, Copy, Loader2, Plus, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CatalogQrCode } from "@/components/app/settings/catalog-qr-code";
import { formatTokenLastUsed } from "@/components/app/settings/settings-state";
import { EmptyState } from "@/components/app/empty-state";
import { SectionHeader } from "@/components/app/section-header";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { copyTextToClipboard } from "@/components/app/gateways/gateways-state";
import { useApiClient } from "@/lib/api-client";
import type { OpdsToken, OpdsTokenCreated } from "@/lib/types";

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
    <div className="min-w-0 space-y-5" data-catalog-state={catalogState}>
      <Alert>
        <TriangleAlert aria-hidden />
        <AlertTitle className="break-words whitespace-normal">
          {t("warningTitle")}
        </AlertTitle>
        <AlertDescription className="break-words whitespace-normal">
          {t("warning")}
        </AlertDescription>
      </Alert>

      <div className="min-w-0 space-y-2">
        <p className="font-heading text-sm font-medium tracking-tight break-words whitespace-normal text-foreground">
          {t("guideTitle")}
        </p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed break-words whitespace-normal text-muted-foreground">
          <li>{t("guideStep1")}</li>
          <li>{t("guideStep2")}</li>
          <li>{t("guideStep3")}</li>
          <li>{t("guideStep4")}</li>
        </ol>
      </div>

      {tokensUnavailable ? (
        <Alert>
          <BookOpen aria-hidden />
          <AlertTitle className="break-words whitespace-normal">
            {t("unavailableTitle")}
          </AlertTitle>
          <AlertDescription className="break-words whitespace-normal">
            {t("unavailable")}
          </AlertDescription>
        </Alert>
      ) : null}

      <SectionHeader
        title={t("linksTitle")}
        description={
          tokens.length > 0 ? t("countLabel", { count: tokens.length }) : undefined
        }
        action={tokensUnavailable ? undefined : createAction}
        className="mb-3"
      />

      {tokensUnavailable ? null : tokens.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={createAction}
        />
      ) : (
        <>
          <RevealGroup className="grid min-w-0 gap-0 divide-y divide-border/70 border-y border-border/70 lg:hidden">
            {tokens.map((token) => (
              <RevealItem key={token.id}>
                <article
                  className="flex min-w-0 flex-col gap-3 py-3.5 first:pt-0 last:pb-0"
                  data-token-id={token.id}
                >
                  <div className="min-w-0 space-y-1">
                    <h3 className="font-heading text-[15px] leading-snug font-medium tracking-tight break-words whitespace-normal">
                      {token.label}
                    </h3>
                    <p className="text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
                      {formatTokenLastUsed(
                        token.last_used_at,
                        locale,
                        t("neverUsed")
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full whitespace-normal sm:w-auto"
                    onClick={() => {
                      setRevokeError(null);
                      setRevokeTarget(token);
                    }}
                  >
                    <Ban aria-hidden />
                    {t("revoke")}
                  </Button>
                </article>
              </RevealItem>
            ))}
          </RevealGroup>

          <Reveal className="hidden min-w-0 overflow-x-auto border-y border-border/70 lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="whitespace-normal">
                    {t("columnLabel")}
                  </TableHead>
                  <TableHead className="whitespace-normal">
                    {t("columnLastUsed")}
                  </TableHead>
                  <TableHead className="text-right whitespace-normal">
                    {t("columnActions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow key={token.id} data-token-id={token.id}>
                    <TableCell className="font-medium">
                      <span className="font-heading line-clamp-2 text-sm font-medium tracking-tight break-words whitespace-normal">
                        {token.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="break-words whitespace-normal sm:whitespace-nowrap">
                        {formatTokenLastUsed(
                          token.last_used_at,
                          locale,
                          t("neverUsed")
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Reveal>
        </>
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
                <div className="min-w-0 space-y-2">
                  <Label
                    htmlFor="catalog-created-url"
                    className="break-words whitespace-normal"
                  >
                    {t("urlLabel")}
                  </Label>
                  <div className="flex min-w-0 gap-2">
                    <Input
                      id="catalog-created-url"
                      readOnly
                      value={created.url}
                      className="min-w-0 flex-1 font-mono text-xs break-all"
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
                <div className="flex min-w-0 flex-col items-center gap-2">
                  <CatalogQrCode url={created.url} />
                  <p className="max-w-full text-center text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
                    {t("qrHint")}
                  </p>
                </div>
                <Alert>
                  <TriangleAlert aria-hidden />
                  <AlertTitle className="break-words whitespace-normal">
                    {t("oneTimeTitle")}
                  </AlertTitle>
                  <AlertDescription className="break-words whitespace-normal">
                    {t("oneTimeWarning")}
                  </AlertDescription>
                </Alert>
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
              <div className="min-w-0 space-y-2">
                <Label
                  htmlFor="catalog-link-label"
                  className="break-words whitespace-normal"
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
                  className="min-w-0"
                  autoComplete="off"
                />
              </div>
              {createError ? (
                <Alert variant="destructive" role="alert">
                  <BookOpen aria-hidden />
                  <AlertTitle className="break-words whitespace-normal">
                    {t("createErrorTitle")}
                  </AlertTitle>
                  <AlertDescription className="break-words whitespace-normal">
                    {createError}
                  </AlertDescription>
                </Alert>
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
        <DialogContent className="max-h-[min(90dvh,40rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="break-words whitespace-normal">
              {t("revokeConfirmTitle")}
            </DialogTitle>
            <DialogDescription className="break-words whitespace-normal">
              {t("revokeConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          {revokeError ? (
            <Alert variant="destructive" role="alert">
              <Ban aria-hidden />
              <AlertTitle className="break-words whitespace-normal">
                {t("revokeErrorTitle")}
              </AlertTitle>
              <AlertDescription className="break-words whitespace-normal">
                {revokeError}
              </AlertDescription>
            </Alert>
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
