"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BrandMark } from "@/components/brand-logo";

type FooterLinkKey =
  | "howItWorks"
  | "delivered"
  | "library"
  | "sources"
  | "docs"
  | "faq"
  | "deliveries"
  | "gateways";

const PRODUCT_LINKS: readonly { href: string; key: FooterLinkKey }[] = [
  { href: "/#how-it-works", key: "howItWorks" },
  { href: "/#delivered", key: "delivered" },
  { href: "/app/bibliotheque", key: "library" },
  { href: "/app/sources", key: "sources" },
];

const RESOURCE_LINKS: readonly { href: string; key: FooterLinkKey }[] = [
  { href: "/docs", key: "docs" },
  { href: "/#faq", key: "faq" },
  { href: "/app/livraisons", key: "deliveries" },
  { href: "/app/gateways", key: "gateways" },
];

/**
 * Marketing footer — brand + two real-link columns, no dead hrefs, no socials.
 */
export function SiteFooter() {
  const t = useTranslations("footer");
  const tBrand = useTranslations("brand");

  return (
    <footer data-testid="landing-footer" className="px-6 pb-16 md:pb-20">
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-8 border-t border-white/15 pt-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
          <div className="flex w-full flex-col gap-4 lg:w-70 lg:shrink-0">
            <Link
              href="/"
              className="inline-flex w-fit items-center gap-2.5 rounded-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <BrandMark className="size-7" />
              <span className="text-base font-bold tracking-tight">
                {tBrand("name")}
              </span>
            </Link>
            <p className="text-sm leading-normal text-muted-foreground text-pretty">
              {t("tagline")}
            </p>
          </div>

          <nav
            className="flex min-w-0 flex-1 gap-6"
            aria-label={t("nav")}
          >
            <FooterColumn title={t("product")} links={PRODUCT_LINKS} t={t} />
            <FooterColumn title={t("resources")} links={RESOURCE_LINKS} t={t} />
          </nav>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">{t("copyright")}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
  t,
}: {
  title: string;
  links: readonly { href: string; key: FooterLinkKey }[];
  t: (key: FooterLinkKey) => string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <p className="text-[13px] font-semibold text-foreground">{title}</p>
      <ul className="flex flex-col gap-3">
        {links.map((link) => (
          <li key={link.key}>
            <Link
              href={link.href}
              className="text-[13px] text-muted-foreground transition-colors duration-125 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {t(link.key)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
