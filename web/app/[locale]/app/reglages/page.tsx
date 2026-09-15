import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { SettingsForm } from "@/components/app/settings/settings-form";
import { safeApiFetch } from "@/lib/api";
import type { OpdsToken } from "@/lib/types";

interface UserSettings {
  email: string;
  kindle_email: string | null;
  default_format: string;
}

export default async function ReglagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.settings");
  const [settings, opdsTokens] = await Promise.all([
    safeApiFetch<UserSettings>("/api/v1/users/me"),
    safeApiFetch<OpdsToken[]>("/api/v1/opds/tokens"),
  ]);

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <SettingsForm
        initialEmail={settings?.email ?? ""}
        initialKindleEmail={settings?.kindle_email ?? ""}
        initialDefaultFormat={settings?.default_format ?? "epub"}
        settingsUnavailable={settings === null}
        initialOpdsTokens={opdsTokens ?? []}
        opdsTokensUnavailable={opdsTokens === null}
      />
    </div>
  );
}
