"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Ban, BookOpen, Copy, Loader2, Plus, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { EmptyState } from "@/components/app/empty-state";
import { SectionHeader } from "@/components/app/section-header";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { useApiClient } from "@/lib/api-client";
import type { OpdsToken, OpdsTokenCreated } from "@/lib/types";

function formatLastUsed(value: string | null, neverLabel: string): string {
  if (!value) return neverLabel;
  try {
    return new Date(value).toLocaleString();
  } catch {
    return neverLabel;
  }
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
  const { call } = useApiClient();
  const [tokens, setTokens] = useState(initialTokens);
  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<OpdsTokenCreated | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<OpdsToken | null>(null);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    setTokens(initialTokens);
  }, [initialTokens]);

  const displayLabel = label.trim() || t("defaultLabel");

  async function submit() {
    setSubmitting(true);
    try {
      const result = await call<OpdsTokenCreated>("/api/v1/opds/tokens", {
        method: "POST",
        body: JSON.stringify({ label: displayLabel }),
      });
      setCreated(result);
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
    }
    setCreateOpen(nextOpen);
  }

  function onCreateKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !submitting && displayLabel) {
      event.preventDefault();
      void submit();
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await call("/api/v1/opds/tokens/revoke", {
        method: "POST",
        body: JSON.stringify({ token_id: revokeTarget.id }),
      });
      setTokens((prev) => prev.filter((row) => row.id !== revokeTarget.id));
      toast.success(t("toastRevoked"));
      setRevokeTarget(null);
    } catch {
      toast.error(t("toastRevokeFailed"));
    } finally {
      setRevoking(false);
    }
  }

  const createAction = (
    <Button type="button" onClick={() => setCreateOpen(true)}>
      <Plus />
      {t("createCta")}
    </Button>
  );

  return (
    <div className="space-y-4">
      <Alert>
        <TriangleAlert />
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
          <BookOpen />
          <AlertTitle>{t("unavailableTitle")}</AlertTitle>
          <AlertDescription>{t("unavailable")}</AlertDescription>
        </Alert>
      ) : null}

      <SectionHeader
        title={t("linksTitle")}
        description={
          tokens.length > 0 ? t("countLabel", { count: tokens.length }) : undefined
        }
        action={createAction}
        className="mb-3"
      />

      {tokens.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={createAction}
        />
      ) : (
        <>
          <RevealGroup className="grid gap-3 md:hidden">
            {tokens.map((token) => (
              <RevealItem key={token.id}>
                <Card size="sm" className="bg-card/60">
                  <CardContent className="space-y-3">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="line-clamp-2 text-sm break-words">
                        {token.label}
                      </CardTitle>
                      <CardDescription>
                        {formatLastUsed(token.last_used_at, t("neverUsed"))}
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRevokeTarget(token)}
                    >
                      <Ban />
                      {t("revoke")}
                    </Button>
                  </CardContent>
                </Card>
              </RevealItem>
            ))}
          </RevealGroup>

          <Reveal className="hidden overflow-hidden rounded-xl border border-border/60 md:block">
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
                      {formatLastUsed(token.last_used_at, t("neverUsed"))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setRevokeTarget(token)}
                      >
                        <Ban />
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
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        void navigator.clipboard.writeText(created.url);
                        toast.success(tCommon("copied"));
                      }}
                    >
                      <Copy />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <CatalogQrCode url={created.url} />
                  <p className="text-xs text-muted-foreground">{t("qrHint")}</p>
                </div>
                <Alert>
                  <TriangleAlert />
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
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => closeCreate(false)}
                  disabled={submitting}
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={() => void submit()}
                  disabled={submitting || !displayLabel}
                >
                  {submitting ? <Loader2 className="animate-spin" /> : null}
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
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevokeTarget(null)}
              disabled={revoking}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmRevoke()}
              disabled={revoking}
            >
              {revoking ? <Loader2 className="animate-spin" /> : <Ban />}
              {t("revoke")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
