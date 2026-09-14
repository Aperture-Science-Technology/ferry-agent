"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Separator } from "@/components/ui/separator";

export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="mx-auto max-w-6xl px-6 py-10">
      <Separator className="mb-8 bg-border/60" />
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="font-heading text-lg font-medium tracking-tight text-foreground">
            Ferry Agent
          </p>
          <p className="text-sm text-muted-foreground">{t("builtBy")}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/#how-it-works" className="transition hover:text-foreground">
            {t("howItWorks")}
          </Link>
          <Link href="/#faq" className="transition hover:text-foreground">
            {t("faq")}
          </Link>
          <Link href="/docs" className="transition hover:text-foreground">
            {t("docs")}
          </Link>
          <Link href="/app/bibliotheque" className="transition hover:text-foreground">
            {t("dashboard")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
