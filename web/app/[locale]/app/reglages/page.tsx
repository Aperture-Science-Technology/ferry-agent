import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { SettingsForm } from "@/components/app/settings/settings-form";
import { safeApiFetch } from "@/lib/api";

interface UserSettings {
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
  const settings = await safeApiFetch<UserSettings>("/api/v1/users/me");

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <SettingsForm
        initialKindleEmail={settings?.kindle_email ?? ""}
        initialDefaultFormat={settings?.default_format ?? "epub"}
        settingsUnavailable={settings === null}
      />
    </div>
  );
}
