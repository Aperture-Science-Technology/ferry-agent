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
import { ReaderCatalogSection } from "@/components/app/settings/reader-catalog-section";
import {
  buildSettingsPatchPayload,
  settingsAreDirty,
} from "@/components/app/settings/settings-state";
import { Reveal } from "@/components/motion/reveal";
import { ApiError, useApiClient } from "@/lib/api-client";
import type { OpdsToken } from "@/lib/types";

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
  initialOpdsTokens,
  opdsTokensUnavailable,
}: {
  initialEmail: string;
  initialKindleEmail: string;
  initialDefaultFormat: string;
  settingsUnavailable: boolean;
  initialOpdsTokens: OpdsToken[];
  opdsTokensUnavailable: boolean;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { call } = useApiClient();
  const [kindleEmail, setKindleEmail] = useState(initialKindleEmail);
  const [defaultFormat, setDefaultFormat] = useState(initialDefaultFormat);
  const [saved, setSaved] = useState({
    kindleEmail: initialKindleEmail,
    defaultFormat: initialDefaultFormat,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState({
    kindleEmail: initialKindleEmail,
    defaultFormat: initialDefaultFormat,
  });
  // After router.refresh(), SSR props become the source of truth again.
  if (
    initialKindleEmail !== baseline.kindleEmail ||
    initialDefaultFormat !== baseline.defaultFormat
  ) {
    setBaseline({
      kindleEmail: initialKindleEmail,
      defaultFormat: initialDefaultFormat,
    });
    setKindleEmail(initialKindleEmail);
    setDefaultFormat(initialDefaultFormat);
    setSaved({
      kindleEmail: initialKindleEmail,
      defaultFormat: initialDefaultFormat,
    });
  }

  const dirty = settingsAreDirty(kindleEmail, defaultFormat, saved);

  // Apres router.refresh(), les props SSR redeviennent la source de verite.
  useEffect(() => {
    setKindleEmail(initialKindleEmail);
    setDefaultFormat(initialDefaultFormat);
  }, [initialKindleEmail, initialDefaultFormat]);

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const savedRemote = await call<SavedSettings>("/api/v1/users/me", {
        method: "PATCH",
        body: JSON.stringify(
          buildSettingsPatchPayload(kindleEmail, defaultFormat)
        ),
      });
      const nextKindle = savedRemote.kindle_email ?? "";
      const nextFormat = savedRemote.default_format;
      setKindleEmail(nextKindle);
      setDefaultFormat(nextFormat);
      setSaved({ kindleEmail: nextKindle, defaultFormat: nextFormat });
      toast.success(t("toastSaved"));
      router.refresh();
    } catch (error) {
      let message = t("toastFailed");
      if (error instanceof ApiError) {
        const detail = parseApiDetail(error.message);
        if (error.status === 422 && detail) {
          message = detail;
        }
      }
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      {settingsUnavailable ? (
        <Alert>
          <Settings2 aria-hidden />
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
              <Input
                id="settings-account-email"
                value={initialEmail}
                readOnly
                disabled
              />
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
                  <Eraser aria-hidden />
                  {t("clearKindleEmail")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("kindleEmailHint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-default-format">{t("defaultFormat")}</Label>
              <Select
                value={defaultFormat}
                onValueChange={(value) => setDefaultFormat(value ?? "epub")}
                disabled={settingsUnavailable}
              >
                <SelectTrigger
                  id="settings-default-format"
                  className="w-full uppercase"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((format) => (
                    <SelectItem
                      key={format}
                      value={format}
                      className="uppercase"
                    >
                      {format}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("defaultFormatHint")}
              </p>
            </div>

            {saveError ? (
              <Alert variant="destructive" role="alert">
                <Settings2 aria-hidden />
                <AlertTitle>{t("saveErrorTitle")}</AlertTitle>
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {dirty ? t("unsavedChanges") : t("allSaved")}
              </p>
              <Button
                type="button"
                onClick={() => void save()}
                disabled={saving || settingsUnavailable || !dirty}
              >
                {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {tCommon("save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal>
        <SectionHeader
          title={t("sourcesTitle")}
          description={t("sourcesDescription")}
        />
        <Card size="sm" className="border-border/60 bg-card/60">
          <CardContent className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">{t("sourcesSummary")}</p>
            <Button
              variant="outline"
              render={
                <Link href="/app/sources">
                  {t("sourcesCta")}
                  <ArrowRight aria-hidden />
                </Link>
              }
            />
          </CardContent>
        </Card>
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
        <SectionHeader
          title={t("devicesTitle")}
          description={t("devicesDescription")}
        />
        <Card size="sm" className="border-border/60 bg-card/60">
          <CardContent className="pt-4">
            <Button
              variant="outline"
              render={
                <Link href="/app/appareils">
                  {t("devicesCta")}
                  <ArrowRight aria-hidden />
                </Link>
              }
            />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
