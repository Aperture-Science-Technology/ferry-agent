"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";

export function SiteHeader() {
  const t = useTranslations("header");

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
          Ferry Agent
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <Link href="/#how-it-works" className="transition hover:text-foreground">
            {t("howItWorks")}
          </Link>
          <Link href="/#delivered" className="transition hover:text-foreground">
            {t("delivered")}
          </Link>
          <Link href="/#faq" className="transition hover:text-foreground">
            {t("faq")}
          </Link>
          <Link href="/docs" className="transition hover:text-foreground">
            {t("docs")}
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <Show when="signed-out">
            <SignInButton>
              <Button variant="ghost" size="sm">
                {t("signIn")}
              </Button>
            </SignInButton>
            <SignInButton>
              <Button size="sm">{t("openDashboard")}</Button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Button size="sm" render={<Link href="/app/bibliotheque">{t("dashboard")}</Link>} />
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}
