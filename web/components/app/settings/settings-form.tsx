"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Eraser, Loader2, Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  const settingsState = settingsUnavailable
    ? "unavailable"
    : saveError
      ? "error"
      : dirty
        ? "dirty"
        : "ready";

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
    <div
      className="min-w-0 max-w-2xl space-y-10 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      data-settings-state={settingsState}
    >
      {settingsUnavailable ? (
        <Alert>
          <Settings2 aria-hidden />
          <AlertTitle className="break-words whitespace-normal">
            {t("unavailableTitle")}
          </AlertTitle>
          <AlertDescription className="break-words whitespace-normal">
            {t("unavailable")}
          </AlertDescription>
        </Alert>
      ) : null}

      <Reveal>
        <SectionHeader
          title={t("deliveryPreferencesTitle")}
          description={t("deliveryPreferencesDescription")}
        />
        <div className="min-w-0 space-y-5">
          <div className="min-w-0 space-y-2">
            <Label
              htmlFor="settings-account-email"
              className="break-words whitespace-normal"
            >
              {t("email")}
            </Label>
            <Input
              id="settings-account-email"
              value={initialEmail}
              readOnly
              disabled
              className="min-w-0"
            />
            <p className="text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
              {t("emailHint")}
            </p>
          </div>

          <div className="min-w-0 space-y-2">
            <Label
              htmlFor="settings-kindle-email"
              className="break-words whitespace-normal"
            >
              {t("kindleEmail")}
            </Label>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="settings-kindle-email"
                type="email"
                value={kindleEmail}
                onChange={(event) => setKindleEmail(event.target.value)}
                placeholder={t("kindleEmailPlaceholder")}
                disabled={settingsUnavailable}
                className="min-w-0 flex-1"
                autoComplete="email"
              />
              <Button
                type="button"
                variant="outline"
                disabled={settingsUnavailable || !kindleEmail}
                onClick={() => setKindleEmail("")}
                className="w-full shrink-0 whitespace-normal sm:w-auto"
              >
                <Eraser aria-hidden />
                {t("clearKindleEmail")}
              </Button>
            </div>
            <p className="text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
              {t("kindleEmailHint")}
            </p>
          </div>

          <div className="min-w-0 space-y-2">
            <Label
              htmlFor="settings-default-format"
              className="break-words whitespace-normal"
            >
              {t("defaultFormat")}
            </Label>
            <Select
              value={defaultFormat}
              onValueChange={(value) => setDefaultFormat(value ?? "epub")}
              disabled={settingsUnavailable}
            >
              <SelectTrigger
                id="settings-default-format"
                className="w-full min-w-0 uppercase"
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
            <p className="text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
              {t("defaultFormatHint")}
            </p>
          </div>

          {saveError ? (
            <Alert variant="destructive" role="alert">
              <Settings2 aria-hidden />
              <AlertTitle className="break-words whitespace-normal">
                {t("saveErrorTitle")}
              </AlertTitle>
              <AlertDescription className="break-words whitespace-normal">
                {saveError}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex min-w-0 flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p
              className="min-w-0 text-xs leading-relaxed break-words whitespace-normal text-muted-foreground"
              aria-live="polite"
              data-settings-dirty={dirty ? "true" : "false"}
            >
              {dirty ? t("unsavedChanges") : t("allSaved")}
            </p>
            <Button
              type="button"
              onClick={() => void save()}
              disabled={saving || settingsUnavailable || !dirty}
              className="w-full shrink-0 whitespace-normal sm:w-auto"
            >
              {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {tCommon("save")}
            </Button>
          </div>
        </div>
      </Reveal>

      <Reveal>
        <SectionHeader
          title={t("sourcesTitle")}
          description={t("sourcesDescription")}
        />
        <div className="min-w-0 space-y-3 border-y border-border/70 py-4">
          <p className="text-sm leading-relaxed break-words whitespace-normal text-muted-foreground">
            {t("sourcesSummary")}
          </p>
          <Button
            variant="outline"
            className="w-full whitespace-normal sm:w-auto"
            render={
              <Link href="/app/sources">
                {t("sourcesCta")}
                <ArrowRight aria-hidden />
              </Link>
            }
          />
        </div>
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
        <div className="min-w-0 border-y border-border/70 py-4">
          <Button
            variant="outline"
            className="w-full whitespace-normal sm:w-auto"
            render={
              <Link href="/app/appareils">
                {t("devicesCta")}
                <ArrowRight aria-hidden />
              </Link>
            }
          />
        </div>
      </Reveal>
    </div>
  );
}
