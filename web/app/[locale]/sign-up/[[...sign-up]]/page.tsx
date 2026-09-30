import { setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { InvitationOnlyPanel } from "@/components/auth/invitation-only-panel";
import type { Locale } from "@/i18n/routing";

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  const locale = localeParam as Locale;
  setRequestLocale(locale);

  return (
    <AuthShell variant="sign-up">
      <InvitationOnlyPanel />
    </AuthShell>
  );
}
