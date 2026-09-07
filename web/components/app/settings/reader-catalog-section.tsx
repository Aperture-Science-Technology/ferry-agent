"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Ban, Copy, Loader2, Plus } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CatalogQrCode } from "@/components/app/settings/catalog-qr-code";
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
  const [revokingId, setRevokingId] = useState<string | null>(null);

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
    if (!nextOpen) {
      setCreated(null);
      setLabel("");
    }
    setCreateOpen(nextOpen);
  }

  async function revoke(token: OpdsToken) {
    setRevokingId(token.id);
    try {
      await call("/api/v1/opds/tokens/revoke", {
        method: "POST",
        body: JSON.stringify({ token_id: token.id }),
      });
      setTokens((prev) => prev.filter((row) => row.id !== token.id));
      toast.success(t("toastRevoked"));
    } catch {
      toast.error(t("toastRevokeFailed"));
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("warning")}</p>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>{t("guideStep1")}</li>
        <li>{t("guideStep2")}</li>
        <li>{t("guideStep3")}</li>
        <li>{t("guideStep4")}</li>
      </ol>

      {tokensUnavailable && (
        <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus />
          {t("createCta")}
        </Button>
      </div>

      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columnLabel")}</TableHead>
              <TableHead>{t("columnLastUsed")}</TableHead>
              <TableHead className="w-[1%]">{t("columnActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token) => (
              <TableRow key={token.id}>
                <TableCell className="font-medium">{token.label}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatLastUsed(token.last_used_at, t("neverUsed"))}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={revokingId === token.id}
                    onClick={() => revoke(token)}
                  >
                    {revokingId === token.id ? <Loader2 className="animate-spin" /> : <Ban />}
                    {t("revoke")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
                  <Label>{t("urlLabel")}</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={created.url} className="font-mono text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(created.url);
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
                <p className="text-sm text-muted-foreground">{t("warning")}</p>
              </div>
              <DialogFooter>
                <Button onClick={() => closeCreate(false)}>{tCommon("done")}</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t("createTitle")}</DialogTitle>
                <DialogDescription>{t("createDescription")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label>{t("labelField")}</Label>
                <Input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder={t("defaultLabel")}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => closeCreate(false)}>
                  {tCommon("cancel")}
                </Button>
                <Button onClick={submit} disabled={submitting || !displayLabel}>
                  {submitting && <Loader2 className="animate-spin" />}
                  {tCommon("create")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
