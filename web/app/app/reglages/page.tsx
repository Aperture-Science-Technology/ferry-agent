import { PageHeader } from "@/components/app/page-header";
import { SettingsForm } from "@/components/app/settings/settings-form";
import { safeApiFetch } from "@/lib/api";

interface UserSettings {
  kindle_email: string | null;
  default_format: string;
}

export default async function ReglagesPage() {
  const settings = await safeApiFetch<UserSettings>("/api/v1/users/me");

  return (
    <div>
      <PageHeader title="Réglages" description="Préférences de livraison de votre compte." />
      <SettingsForm
        initialKindleEmail={settings?.kindle_email ?? ""}
        initialDefaultFormat={settings?.default_format ?? "epub"}
        settingsUnavailable={settings === null}
      />
    </div>
  );
}
