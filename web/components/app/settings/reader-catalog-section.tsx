"use client";

import { useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Ban, BookOpen, Copy, Loader2, Plus, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
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
    <Button type="button" onClick={() => setCreateOpen(true)}>
      <Plus aria-hidden />
      {t("createCta")}
    </Button>
  );

  return (
    <div className="space-y-4">
      <Alert>
        <TriangleAlert aria-hidden />
        <AlertTitle>{t("warningTitle")}</AlertTitle>
        <AlertDescription>{t("warning")}</AlertDescription>
      </Alert>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{t("guideTitle")}</p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>{t("guideStep1")}</li>
          <li>{t("guideStep2")}</li>
          <li>{t("guideStep3")}</li>
          <li>{t("guideStep4")}</li>
        </ol>
      </div>

      {tokensUnavailable ? (
        <Alert>
          <BookOpen aria-hidden />
          <AlertTitle>{t("unavailableTitle")}</AlertTitle>
          <AlertDescription>{t("unavailable")}</AlertDescription>
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
          <RevealGroup className="grid gap-3 lg:hidden">
            {tokens.map((token) => (
              <RevealItem key={token.id}>
                <Card size="sm" className="bg-card/60">
                  <CardContent className="space-y-3">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="line-clamp-2 text-sm break-words">
                        {token.label}
                      </CardTitle>
                      <CardDescription>
                        {formatTokenLastUsed(
                          token.last_used_at,
                          locale,
                          t("neverUsed")
                        )}
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRevokeError(null);
                        setRevokeTarget(token);
                      }}
                    >
                      <Ban aria-hidden />
                      {t("revoke")}
                    </Button>
                  </CardContent>
                </Card>
              </RevealItem>
            ))}
          </RevealGroup>

          <Reveal className="hidden overflow-hidden rounded-xl border border-border/60 lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("columnLabel")}</TableHead>
                  <TableHead>{t("columnLastUsed")}</TableHead>
                  <TableHead className="text-right">{t("columnActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell className="font-medium">
                      <span className="line-clamp-2 break-words">{token.label}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatTokenLastUsed(
                        token.last_used_at,
                        locale,
                        t("neverUsed")
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
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

      <Dialog open={createOpen} onOpenChange={closeCreate}>
        <DialogContent className="sm:max-w-md">
          {created ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("createdTitle")}</DialogTitle>
                <DialogDescription>{t("createdDescription")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="catalog-created-url">{t("urlLabel")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="catalog-created-url"
                      readOnly
                      value={created.url}
                      className="font-mono text-xs break-all"
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={t("copyUrlAria")}
                      onClick={() => void handleCopyUrl(created.url)}
                    >
                      <Copy aria-hidden />
                    </Button>
                  </div>
                  {copyFailed ? (
                    <p className="text-xs text-destructive" role="alert">
                      {tCommon("copyFailed")}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-center gap-2">
                  <CatalogQrCode url={created.url} />
                  <p className="text-xs text-muted-foreground">{t("qrHint")}</p>
                </div>
                <Alert>
                  <TriangleAlert aria-hidden />
                  <AlertTitle>{t("oneTimeTitle")}</AlertTitle>
                  <AlertDescription>{t("oneTimeWarning")}</AlertDescription>
                </Alert>
              </div>
              <DialogFooter>
                <Button type="button" onClick={() => closeCreate(false)}>
                  {tCommon("done")}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t("createTitle")}</DialogTitle>
                <DialogDescription>{t("createDescription")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="catalog-link-label">{t("labelField")}</Label>
                <Input
                  id="catalog-link-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  onKeyDown={onCreateKeyDown}
                  placeholder={t("defaultLabel")}
                  disabled={submitting}
                />
              </div>
              {createError ? (
                <Alert variant="destructive" role="alert">
                  <BookOpen aria-hidden />
                  <AlertTitle>{t("createErrorTitle")}</AlertTitle>
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => closeCreate(false)}
                  disabled={submitting}
                  autoFocus
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={() => void submit()}
                  disabled={submitting || !displayLabel}
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
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("revokeConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("revokeConfirmDescription")}</DialogDescription>
          </DialogHeader>
          {revokeError ? (
            <Alert variant="destructive" role="alert">
              <Ban aria-hidden />
              <AlertTitle>{t("revokeErrorTitle")}</AlertTitle>
              <AlertDescription>{revokeError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevokeTarget(null)}
              disabled={revoking}
              autoFocus
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmRevoke()}
              disabled={revoking}
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
