"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { PassageRule } from "@/components/passage-rule";

const FOOTER_LINKS = [
  { href: "/#how-it-works", key: "howItWorks" as const },
  { href: "/#faq", key: "faq" as const },
  { href: "/docs", key: "docs" as const },
  { href: "/app/bibliotheque", key: "dashboard" as const },
] as const;

/**
 * Marketing footer — BrandLogo lockup, paper rule, existing routes/anchors.
 * Focus rings match the header; no SaaS chrome.
 */
export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <footer
      data-testid="landing-footer"
      className="border-t border-border"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <PassageRule tone="muted" />
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            <Link
              href="/"
              className="inline-flex min-w-0 rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <BrandLogo className="text-foreground" />
            </Link>
            <p className="text-sm text-muted-foreground">{t("builtBy")}</p>
          </div>
          <nav
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
            aria-label={t("nav")}
          >
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className="rounded-sm transition-colors duration-125 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {t(link.key)}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
