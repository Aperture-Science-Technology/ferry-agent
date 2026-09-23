"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CircleAlert, Eraser, Loader2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReaderCatalogSection } from "@/components/app/settings/reader-catalog-section";
import {
  SettingsEmpty,
  SettingsFeedback,
} from "@/components/app/settings/settings-feedback";
import {
  SettingsFormField,
  settingsFormControlClass,
} from "@/components/app/settings/settings-form-field";
import {
  buildSettingsPatchPayload,
  settingsAreDirty,
} from "@/components/app/settings/settings-state";
import { Reveal } from "@/components/motion/reveal";
import { ApiError, useApiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
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
  title,
  description,
  descriptionMobile,
  initialEmail,
  initialKindleEmail,
  initialDefaultFormat,
  settingsUnavailable,
  initialOpdsTokens,
  opdsTokensUnavailable,
}: {
  title: string;
  description: string;
  descriptionMobile: string;
  initialEmail: string;
  initialKindleEmail: string;
  initialDefaultFormat: string;
  settingsUnavailable: boolean;
  initialOpdsTokens: OpdsToken[];
  opdsTokensUnavailable: boolean;
}) {
  const t = useTranslations("settings");
  const tBrand = useTranslations("brand");
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
      className={cn(
        "flex min-w-0 flex-col gap-3",
        "pb-[max(0.5rem,env(safe-area-inset-bottom))] md:gap-6"
      )}
      data-testid="settings-pen-layout"
      data-settings-state={settingsState}
    >
      {/* Title stacks are dedicated (mF005b Top vs Hd0003); no shared DashboardHeader. */}
      <div className="flex flex-col gap-2 md:min-h-[72px]">
        <header
          data-testid="settings-header-mobile"
          className="flex flex-col gap-2 md:hidden"
        >
          <p className="font-heading text-sm font-medium text-muted-foreground">
            {tBrand("name")}
          </p>
          <h1 className="font-heading text-[22px] font-medium text-foreground">
            {title}
          </h1>
          <p className="text-xs font-medium text-muted-foreground">
            {descriptionMobile}
          </p>
        </header>

        <header
          data-testid="settings-header-desktop"
          className="hidden min-w-0 flex-1 flex-col gap-2 md:flex"
        >
          <h1 className="font-heading text-[28px] font-medium text-foreground">
            {title}
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            {description}
          </p>
        </header>
      </div>

      {settingsUnavailable ? (
        <SettingsEmpty
          role="alert"
          icon={CircleAlert}
          title={t("unavailableTitle")}
          description={t("unavailable")}
        />
      ) : null}

      <div data-testid="settings-body" className="flex min-w-0 flex-col gap-3 md:gap-6">
        <Reveal>
          <section
            className="flex min-w-0 flex-col gap-3 md:gap-6"
            data-testid="settings-delivery"
          >
            {/* Pen Sec1 — desktop only (absent from mF005b Body). */}
            <h2 className="hidden font-heading text-base font-medium text-foreground md:block">
              {t("deliveryPreferencesTitle")}
            </h2>

            {/* Pen desktop: account email; mobile Top/Body omits it */}
            <SettingsFormField
              htmlFor="settings-account-email"
              label={t("email")}
              hint={t("emailHint")}
              className="hidden md:flex md:flex-col"
            >
              <Input
                id="settings-account-email"
                value={initialEmail}
                readOnly
                disabled
                className={settingsFormControlClass}
              />
            </SettingsFormField>

            <SettingsFormField
              htmlFor="settings-kindle-email"
              label={t("kindleEmail")}
              hint={t("kindleEmailHint")}
            >
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="settings-kindle-email"
                  type="email"
                  value={kindleEmail}
                  onChange={(event) => setKindleEmail(event.target.value)}
                  placeholder={t("kindleEmailPlaceholder")}
                  disabled={settingsUnavailable}
                  className={cn(settingsFormControlClass, "min-w-0 flex-1")}
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
            </SettingsFormField>

            <SettingsFormField
              htmlFor="settings-default-format"
              label={t("defaultFormat")}
              hint={t("defaultFormatHint")}
            >
              <Select
                value={defaultFormat}
                onValueChange={(value) => setDefaultFormat(value ?? "epub")}
                disabled={settingsUnavailable}
              >
                <SelectTrigger
                  id="settings-default-format"
                  className={cn(settingsFormControlClass, "uppercase")}
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
            </SettingsFormField>

            {saveError ? (
              <SettingsFeedback
                role="alert"
                icon={TriangleAlert}
                title={t("saveErrorTitle")}
                description={saveError}
              />
            ) : null}

            <div className="flex min-w-0 flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p
                className="min-w-0 text-xs font-medium leading-relaxed break-words whitespace-normal text-muted-foreground"
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
          </section>
        </Reveal>

        <Reveal>
          <section
            className="flex min-w-0 flex-col gap-3 md:gap-4"
            data-testid="settings-opds"
          >
            <div className="hidden min-w-0 flex-col gap-1 md:flex">
              <h2 className="font-heading text-base font-medium text-foreground">
                {t("readerCatalogTitle")}
              </h2>
              <p className="text-sm font-medium text-muted-foreground">
                {t("readerCatalogDescription")}
              </p>
            </div>
            <ReaderCatalogSection
              initialTokens={initialOpdsTokens}
              tokensUnavailable={opdsTokensUnavailable}
            />
          </section>
        </Reveal>
      </div>
    </div>
  );
}
