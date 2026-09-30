"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * Sign-up is invitation-only: replace Clerk's restricted card with a clear panel.
 */
export function InvitationOnlyPanel() {
  const t = useTranslations("auth.signUpInvite");

  return (
    <div
      data-testid="invitation-only-panel"
      className="flex w-full flex-col gap-4"
    >
      <h1 className="font-heading text-[30px] leading-9 font-bold tracking-tight text-foreground">
        {t("title")}
      </h1>
      <p className="text-[15px] leading-snug text-muted-foreground">{t("body")}</p>
      <Button
        className="h-9 w-full rounded-[10px]"
        render={<Link href="/sign-in">{t("ctaSignIn")}</Link>}
      />
      <p className="text-[13px] leading-snug text-muted-foreground">{t("hint")}</p>
      <Button
        variant="outline"
        className="h-9 w-full rounded-[10px]"
        render={<Link href="/docs">{t("ctaDocs")}</Link>}
      />
    </div>
  );
}
