"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SourcesManager } from "@/components/app/sources/sources-manager";
import { ReaderCatalogSection } from "@/components/app/settings/reader-catalog-section";
import { ApiError, useApiClient } from "@/lib/api-client";
import type { OpdsToken, Source } from "@/lib/types";

const FORMATS = ["epub", "mobi", "azw3", "pdf"] as const;

type SavedSettings = {
  kindle_email: string | null;
  default_format: string;
};

function parseApiDetail(raw: string): string | null {
  try {
    const body = JSON.parse(raw) as { detail?: unknown };
    if (typeof body.detail === "string" && body.detail.trim()) {
      return body.detail.trim();
    }
    if (Array.isArray(body.detail)) {
      const first = body.detail[0] as { msg?: string } | undefined;
      if (first?.msg) return first.msg;
    }
  } catch {
    // plain text
  }
  const trimmed = raw.trim();
  return trimmed || null;
}

export function SettingsForm({
  initialEmail,
  initialKindleEmail,
  initialDefaultFormat,
  settingsUnavailable,
  initialSources,
  sourcesUnavailable,
  initialOpdsTokens,
  opdsTokensUnavailable,
}: {
  initialEmail: string;
  initialKindleEmail: string;
  initialDefaultFormat: string;
  settingsUnavailable: boolean;
  initialSources: Source[];
  sourcesUnavailable: boolean;
  initialOpdsTokens: OpdsToken[];
  opdsTokensUnavailable: boolean;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { call } = useApiClient();
  const [kindleEmail, setKindleEmail] = useState(initialKindleEmail);
  const [defaultFormat, setDefaultFormat] = useState(initialDefaultFormat);
  const [saving, setSaving] = useState(false);

  // Apres router.refresh(), les props SSR redeviennent la source de verite.
  useEffect(() => {
    setKindleEmail(initialKindleEmail);
    setDefaultFormat(initialDefaultFormat);
  }, [initialKindleEmail, initialDefaultFormat]);

  async function save() {
    setSaving(true);
    try {
      const saved = await call<SavedSettings>("/api/v1/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          kindle_email: kindleEmail.trim() ? kindleEmail.trim() : null,
          default_format: defaultFormat,
        }),
      });
      setKindleEmail(saved.kindle_email ?? "");
      setDefaultFormat(saved.default_format);
      toast.success(t("toastSaved"));
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        const detail = parseApiDetail(error.message);
        if (error.status === 422 && detail) {
          toast.error(detail);
        } else {
          toast.error(t("toastFailed"));
        }
      } else {
        toast.error(t("toastFailed"));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      {settingsUnavailable && (
        <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
      )}

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle className="font-heading text-lg font-medium">
            {t("accountTitle")}
          </CardTitle>
          <CardDescription>{t("accountDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("email")}</Label>
            <Input value={initialEmail} readOnly disabled />
            <p className="text-xs text-muted-foreground">{t("emailHint")}</p>
          </div>
          <div className="space-y-2">
            <Label>{t("kindleEmail")}</Label>
            <Input
              type="email"
              value={kindleEmail}
              onChange={(event) => setKindleEmail(event.target.value)}
              placeholder={t("kindleEmailPlaceholder")}
              disabled={settingsUnavailable}
            />
            <p className="text-xs text-muted-foreground">{t("kindleEmailHint")}</p>
          </div>
          <div className="space-y-2">
            <Label>{t("defaultFormat")}</Label>
            <Select
              value={defaultFormat}
              onValueChange={(value) => setDefaultFormat(value ?? "epub")}
              disabled={settingsUnavailable}
            >
              <SelectTrigger className="w-full uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map((format) => (
                  <SelectItem key={format} value={format} className="uppercase">
                    {format}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("defaultFormatHint")}</p>
          </div>
          <Button onClick={save} disabled={saving || settingsUnavailable}>
            {saving && <Loader2 className="animate-spin" />}
            {tCommon("save")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle className="font-heading text-lg font-medium">
            {t("sourcesTitle")}
          </CardTitle>
          <CardDescription>{t("sourcesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SourcesManager initialSources={initialSources} sourcesUnavailable={sourcesUnavailable} />
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle className="font-heading text-lg font-medium">
            {t("readerCatalogTitle")}
          </CardTitle>
          <CardDescription>{t("readerCatalogDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ReaderCatalogSection
            initialTokens={initialOpdsTokens}
            tokensUnavailable={opdsTokensUnavailable}
          />
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle className="font-heading text-lg font-medium">
            {t("devicesTitle")}
          </CardTitle>
          <CardDescription>{t("devicesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            render={
              <Link href="/app/appareils">
                {t("devicesCta")}
                <ArrowRight />
              </Link>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
