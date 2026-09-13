"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Eraser, Loader2, Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionHeader } from "@/components/app/section-header";
import { SourcesManager } from "@/components/app/sources/sources-manager";
import { ReaderCatalogSection } from "@/components/app/settings/reader-catalog-section";
import { Reveal } from "@/components/motion/reveal";
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
    <div className="mx-auto max-w-2xl space-y-10">
      {settingsUnavailable ? (
        <Alert>
          <Settings2 />
          <AlertTitle>{t("unavailableTitle")}</AlertTitle>
          <AlertDescription>{t("unavailable")}</AlertDescription>
        </Alert>
      ) : null}

      <Reveal>
        <SectionHeader
          title={t("deliveryPreferencesTitle")}
          description={t("deliveryPreferencesDescription")}
        />
        <Card className="border-border/60 bg-card/60">
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-2">
              <Label htmlFor="settings-account-email">{t("email")}</Label>
              <Input id="settings-account-email" value={initialEmail} readOnly disabled />
              <p className="text-xs text-muted-foreground">{t("emailHint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-kindle-email">{t("kindleEmail")}</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="settings-kindle-email"
                  type="email"
                  value={kindleEmail}
                  onChange={(event) => setKindleEmail(event.target.value)}
                  placeholder={t("kindleEmailPlaceholder")}
                  disabled={settingsUnavailable}
                  className="min-w-0 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={settingsUnavailable || !kindleEmail}
                  onClick={() => setKindleEmail("")}
                  className="shrink-0"
                >
                  <Eraser />
                  {t("clearKindleEmail")}
                </Button>
              </div>
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

            <Button type="button" onClick={save} disabled={saving || settingsUnavailable}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              {tCommon("save")}
            </Button>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal>
        <SectionHeader title={t("sourcesTitle")} description={t("sourcesDescription")} />
        <SourcesManager
          initialSources={initialSources}
          sourcesUnavailable={sourcesUnavailable}
        />
      </Reveal>

      <Reveal>
        <SectionHeader
          title={t("readerCatalogTitle")}
          description={t("readerCatalogDescription")}
        />
        <ReaderCatalogSection
          initialTokens={initialOpdsTokens}
          tokensUnavailable={opdsTokensUnavailable}
        />
      </Reveal>

      <Reveal>
        <SectionHeader title={t("devicesTitle")} description={t("devicesDescription")} />
        <Card size="sm" className="border-border/60 bg-card/60">
          <CardContent className="pt-4">
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
      </Reveal>
    </div>
  );
}
