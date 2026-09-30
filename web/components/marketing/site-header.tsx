"use client";

import { useEffect, useState } from "react";
import { Show, UserButton } from "@clerk/nextjs";
import { MenuIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { LocaleMenu, LocalePair } from "@/components/locale-switcher";
import { BrandMark } from "@/components/brand-logo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/#how-it-works", key: "howItWorks" as const, match: null },
  { href: "/#delivered", key: "delivered" as const, match: null },
  { href: "/#faq", key: "faq" as const, match: null },
  { href: "/docs", key: "docs" as const, match: "/docs" },
];

/** Resting marketing header chrome: 16px mobile / 28px desktop top offset + 70px bar. */
const HEADER_SPACER =
  "pointer-events-none h-[86px] shrink-0 lg:h-[98px]";

function useScrolledPastTop() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function sync() {
      setScrolled(window.scrollY > 0);
    }
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);

  return scrolled;
}

function BrandLockup() {
  const tBrand = useTranslations("brand");

  return (
    <span className="inline-flex shrink-0 items-center gap-3 text-foreground">
      <BrandMark className="size-7" />
      <span className="whitespace-nowrap text-[17px] font-semibold tracking-tight">
        {tBrand("name")}
      </span>
    </span>
  );
}

export function SiteHeader() {
  const t = useTranslations("header");
  const tLanding = useTranslations("landing.nav");
  const tLocale = useTranslations("locale");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const scrolled = useScrolledPastTop();
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <>
      <header className="fixed top-0 z-20 w-full">
        {/*
          Top offset: Pen Nav Shell uses 28px desktop (16px mobile).
          Older plan prose said « 8px margin + 16px padding » (=24); the frame
          is authoritative, so we keep 28 / 16.
        */}
        <div className="flex justify-center px-6 pt-4 lg:px-12 lg:pt-7">
          <div
            className={cn(
              // Horizontal px-[18px] is always on so logo/actions do not shift
              // when the scrolled chrome (padding 12/18 in the Pen) appears.
              // Rest frame lists padding 16px 0; no-jump wins over that prose.
              // Transparent 1px border at rest avoids a 1px box jump on scroll.
              "flex h-[70px] w-full max-w-[1152px] items-center justify-between gap-3 border border-transparent px-[18px] py-4",
              "transition-[height,padding,background-color,border-color,border-radius,box-shadow] duration-300 ease-out",
              "motion-reduce:transition-none",
              scrolled &&
                "h-[58px] rounded-[18px] border-white/24 bg-[#0F1114F2] py-3 shadow-[0_8px_32px_rgba(0,0,0,0.28)] backdrop-blur-xl backdrop-saturate-150"
            )}
          >
            <Link
              href="/"
              className="inline-flex shrink-0 items-center rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <BrandLockup />
            </Link>

            <nav
              className="hidden shrink-0 items-center gap-[26px] text-[14px] lg:flex"
              aria-label={t("primaryNav")}
            >
              {NAV_LINKS.map((link) => {
                const active =
                  link.match !== null &&
                  (pathname === link.match ||
                    pathname.startsWith(`${link.match}/`));
                return (
                  <Link
                    key={link.key}
                    href={link.href}
                    className={cn(
                      "whitespace-nowrap rounded-sm transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      active
                        ? "font-semibold text-[#F4F7F2]"
                        : "font-normal text-[#A4AEA8] hover:text-[#F4F7F2]"
                    )}
                    {...(active ? { "aria-current": "page" as const } : {})}
                  >
                    {t(link.key)}
                  </Link>
                );
              })}
            </nav>

            <div className="flex shrink-0 items-center gap-2 lg:gap-3.5">
              {/*
                LocalePair keeps shared develop chrome; override here to the
                Pen bare FR/EN text pair (no frame, border, or fill).
              */}
              <LocalePair className="hidden gap-2 lg:inline-flex [&_button]:h-auto [&_button]:min-h-0 [&_button]:rounded-none [&_button]:border-transparent [&_button]:bg-transparent [&_button]:px-0 [&_button]:py-0 [&_button]:text-[13px] [&_button]:font-normal [&_button]:shadow-none [&_button]:hover:bg-transparent [&_button]:active:translate-y-0 [&_button[aria-pressed=true]]:font-semibold" />
              <LocaleMenu
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="transition-colors duration-125 lg:hidden"
                  >
                    {tLocale(locale)}
                  </Button>
                }
              />

              <div className="hidden items-center gap-3.5 lg:flex">
                <Show when="signed-out">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-[10px] border border-white/[0.125] bg-white/[0.03] px-3.5 text-sm transition-colors duration-150 hover:bg-white/[0.06]"
                    render={<Link href="/sign-in">{tLanding("signIn")}</Link>}
                  />
                  <Button
                    size="sm"
                    className="h-9 rounded-[10px] px-4 text-sm transition-colors duration-150"
                    render={
                      <Link href="/sign-in">{tLanding("dashboard")}</Link>
                    }
                  />
                </Show>
                <Show when="signed-in">
                  <Button
                    size="sm"
                    className="h-9 rounded-[10px] px-4 text-sm transition-colors duration-150"
                    render={
                      <Link href="/app/bibliotheque">{tLanding("dashboard")}</Link>
                    }
                  />
                </Show>
              </div>

              <Show when="signed-in">
                <UserButton />
              </Show>

              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-11 min-h-11 min-w-11 transition-colors duration-150 lg:hidden"
                      aria-expanded={menuOpen}
                      aria-controls="site-header-mobile-nav"
                      aria-label={menuOpen ? t("menuClose") : t("menuOpen")}
                    />
                  }
                >
                  <MenuIcon className="size-6" aria-hidden />
                  <span className="sr-only">
                    {menuOpen ? t("menuClose") : t("menuOpen")}
                  </span>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-[min(100%,20rem)] gap-0 p-0"
                  id="site-header-mobile-nav"
                >
                  <SheetHeader className="border-b border-border p-4">
                    <SheetTitle className="font-heading text-left text-base">
                      {t("primaryNav")}
                    </SheetTitle>
                  </SheetHeader>
                  <nav
                    className="flex flex-col gap-1 p-3"
                    aria-label={t("primaryNav")}
                  >
                    {NAV_LINKS.map((link) => (
                      <Link
                        key={link.key}
                        href={link.href}
                        className="rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors duration-150 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        onClick={closeMenu}
                      >
                        {t(link.key)}
                      </Link>
                    ))}
                  </nav>
                  <div className="mt-auto space-y-2 border-t border-border p-4">
                    <Show when="signed-out">
                      <Button
                        variant="outline"
                        className="w-full transition-colors duration-150"
                        render={
                          <Link href="/sign-in" onClick={closeMenu}>
                            {tLanding("signIn")}
                          </Link>
                        }
                      />
                      <Button
                        className="w-full transition-colors duration-150"
                        render={
                          <Link href="/sign-in" onClick={closeMenu}>
                            {tLanding("dashboard")}
                          </Link>
                        }
                      />
                    </Show>
                    <Show when="signed-in">
                      <Button
                        className="w-full transition-colors duration-150"
                        render={
                          <Link href="/app/bibliotheque" onClick={closeMenu}>
                            {tLanding("dashboard")}
                          </Link>
                        }
                      />
                    </Show>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
      {/* Reserves resting header height so anchors clear the fixed bar. */}
      <div aria-hidden className={HEADER_SPACER} />
    </>
  );
}
