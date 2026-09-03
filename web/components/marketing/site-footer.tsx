"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Separator } from "@/components/ui/separator";

export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="mx-auto max-w-6xl px-6 py-10">
      <Separator className="mb-8 bg-border/60" />
      <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <p>{t("builtBy")}</p>
        <div className="flex items-center gap-6">
          <span>{t("openSource")}</span>
          <Link href="/docs" className="transition hover:text-foreground">
            {t("docs")}
          </Link>
          <Link href="/app/bibliotheque" className="transition hover:text-foreground">
            {t("dashboard")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
