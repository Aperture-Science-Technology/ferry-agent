"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight, CircleAlert, Eraser, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReaderCatalogSection } from "@/components/app/settings/reader-catalog-section";
import {
  SettingsEmpty,
  SettingsFeedbackError,
} from "@/components/app/settings/settings-feedback";
import {
  SettingsFormField,
  settingsFormControlClass,
  settingsFormLabelClass,
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

function PreferencesRow({
  title,
  subtitle,
  href,
  onClick,
  ariaLabel,
  showBorder = true,
  chevron = true,
}: {
  title: string;
  subtitle: string;
  href?: string;
  onClick?: () => void;
  ariaLabel?: string;
  showBorder?: boolean;
  chevron?: boolean;
}) {
  const body = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs font-medium text-muted-foreground">
          {subtitle}
        </span>
      </div>
      {chevron ? (
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      ) : null}
    </>
  );

  const rowClass = cn(
    "flex w-full min-w-0 items-center gap-4 py-4 text-left",
    showBorder && "border-b border-border",
    (href || onClick) &&
      "rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
  );

  if (href) {
    return (
      <Link href={href} className={rowClass} aria-label={ariaLabel ?? title}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        className={rowClass}
        onClick={onClick}
        aria-label={ariaLabel ?? title}
      >
        {body}
      </button>
    );
  }

  return <div className={rowClass}>{body}</div>;
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
  const locale = useLocale();
  const pathname = usePathname();
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

  function cancelEdits() {
    setKindleEmail(saved.kindleEmail);
    setDefaultFormat(saved.defaultFormat);
    setSaveError(null);
  }

  function cycleLocale() {
    const index = routing.locales.indexOf(locale as Locale);
    const next = routing.locales[(index + 1) % routing.locales.length];
    if (!next || next === locale) return;
    router.replace(pathname, { locale: next });
  }

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

  const languageValue =
    locale === "en" ? t("languageValueEn") : t("languageValueFr");

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-4",
        "pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      )}
      data-testid="settings-pen-layout"
      data-settings-state={settingsState}
    >
      {/* Header/Page — already conforming; do not restyle. */}
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

      {/* Content — gap 12 */}
      <div
        data-testid="settings-body"
        className="flex min-w-0 flex-col gap-3"
      >
        <Reveal>
          <section
            className="flex min-w-0 flex-col gap-3"
            data-testid="settings-delivery"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="text-base font-medium text-foreground">
                {t("accountTitle")}
              </h2>
              <p className="text-[13px] font-medium text-muted-foreground">
                {t("accountDescription")}
              </p>
            </div>

            <div className="flex min-w-0 flex-col gap-5 rounded-lg border border-border bg-card p-6">
              <div className="flex min-w-0 flex-col gap-4">
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
                      variant="ghost"
                      disabled={settingsUnavailable || !kindleEmail}
                      onClick={() => setKindleEmail("")}
                      className="w-full shrink-0 whitespace-normal sm:w-auto"
                    >
                      <Eraser aria-hidden />
                      {t("clearKindleEmail")}
                    </Button>
                  </div>
                </SettingsFormField>

                <div
                  data-testid="settings-field"
                  className="flex min-w-0 flex-col gap-1.5"
                >
                  <p
                    id="settings-default-format-label"
                    className={settingsFormLabelClass}
                  >
                    {t("defaultFormat")}
                  </p>
                  <div
                    role="group"
                    aria-labelledby="settings-default-format-label"
                    className="flex min-w-0 flex-wrap gap-2"
                  >
                    {FORMATS.map((format) => {
                      const selected = defaultFormat === format;
                      return (
                        <button
                          key={format}
                          type="button"
                          aria-pressed={selected}
                          disabled={settingsUnavailable}
                          onClick={() => setDefaultFormat(format)}
                          className={cn(
                            "rounded-full px-4 py-2.5 text-[13px] font-medium uppercase transition-colors",
                            "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            "disabled:pointer-events-none disabled:opacity-50",
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "border border-border bg-secondary text-secondary-foreground"
                          )}
                        >
                          {format}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
                    {t("defaultFormatAppliedHint")}
                  </p>
                </div>
              </div>

              {saveError ? (
                <SettingsFeedbackError
                  title={t("saveErrorTitle")}
                  description={saveError}
                  dismissLabel={tCommon("dismiss")}
                  onDismiss={() => setSaveError(null)}
                  retryLabel={tCommon("retry")}
                  onRetry={() => void save()}
                />
              ) : null}

              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p
                  className="min-w-0 text-xs font-medium leading-relaxed break-words whitespace-normal text-muted-foreground"
                  aria-live="polite"
                  data-settings-dirty={dirty ? "true" : "false"}
                >
                  {dirty ? t("unsavedChanges") : t("allSaved")}
                </p>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={cancelEdits}
                    disabled={saving || settingsUnavailable || !dirty}
                    className="w-full whitespace-normal sm:w-auto"
                  >
                    {tCommon("cancel")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving || settingsUnavailable || !dirty}
                    className="w-full shrink-0 whitespace-normal sm:w-auto"
                  >
                    {saving ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : null}
                    {tCommon("save")}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section
            className="flex min-w-0 flex-col gap-3"
            data-testid="settings-opds"
          >
            <ReaderCatalogSection
              initialTokens={initialOpdsTokens}
              tokensUnavailable={opdsTokensUnavailable}
            />
          </section>
        </Reveal>

        <Reveal>
          <section
            className="flex min-w-0 flex-col gap-3"
            data-testid="settings-preferences"
          >
            <h2 className="text-base font-medium text-foreground">
              {t("preferencesTitle")}
            </h2>
            <div className="flex min-w-0 flex-col rounded-lg border border-border bg-card px-5 py-2">
              {/* Account email — exists in app, absent from Pen Compte → Préférences row */}
              <PreferencesRow
                title={t("email")}
                subtitle={initialEmail || t("emailHint")}
                showBorder
                chevron={false}
              />
              <PreferencesRow
                title={t("languageLabel")}
                subtitle={languageValue}
                onClick={cycleLocale}
                ariaLabel={t("languageSwitchAria")}
                showBorder
              />
              <PreferencesRow
                title={t("documentationLabel")}
                subtitle={t("documentationHint")}
                href="/docs"
                showBorder={false}
              />
            </div>
          </section>
        </Reveal>
      </div>
    </div>
  );
}
