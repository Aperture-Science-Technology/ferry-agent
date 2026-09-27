"use client";

import { useState } from "react";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { BrandMark } from "@/components/brand-logo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV_LINKS = [
  { href: "/#how-it-works", key: "howItWorks" as const },
  { href: "/#delivered", key: "delivered" as const },
  { href: "/#faq", key: "faq" as const },
  { href: "/docs", key: "docs" as const },
];

function BrandLockup() {
  const tBrand = useTranslations("brand");

  return (
    <span className="inline-flex shrink-0 items-center gap-2.5 text-foreground">
      <BrandMark className="size-7" />
      <span className="whitespace-nowrap text-base font-semibold tracking-tight">
        {tBrand("name")}
      </span>
    </span>
  );
}

export function SiteHeader() {
  const t = useTranslations("header");
  const tLanding = useTranslations("landing.nav");
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 bg-background">
      <div className="px-6 lg:flex lg:justify-center lg:px-12 lg:pt-2">
        <div className="flex h-16 w-full items-center justify-between gap-3 lg:h-[70px] lg:max-w-[880px] lg:border lg:border-white/15 lg:bg-transparent lg:px-4 lg:py-4">
          <Link
            href="/"
            className="inline-flex shrink-0 items-center rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <BrandLockup />
          </Link>

          <nav
            className="hidden shrink-0 items-center gap-5 text-sm text-muted-foreground lg:flex"
            aria-label={t("primaryNav")}
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className="whitespace-nowrap rounded-sm transition-colors duration-150 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {t(link.key)}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 lg:gap-3">
            <LocaleSwitcher appearance="nav" />

            <div className="hidden items-center gap-3 lg:flex">
              <Show when="signed-out">
                <SignInButton>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 border border-border bg-accent px-3 text-sm transition-colors duration-150"
                  >
                    {tLanding("signIn")}
                  </Button>
                </SignInButton>
                <SignInButton>
                  <Button
                    size="sm"
                    className="h-8 px-3 text-sm transition-colors duration-150"
                  >
                    {tLanding("dashboard")}
                  </Button>
                </SignInButton>
              </Show>
              <Show when="signed-in">
                <Button
                  size="sm"
                  className="h-8 px-3 text-sm transition-colors duration-150"
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
                    <SignInButton>
                      <Button
                        variant="outline"
                        className="w-full transition-colors duration-150"
                        onClick={closeMenu}
                      >
                        {tLanding("signIn")}
                      </Button>
                    </SignInButton>
                    <SignInButton>
                      <Button
                        className="w-full transition-colors duration-150"
                        onClick={closeMenu}
                      >
                        {tLanding("dashboard")}
                      </Button>
                    </SignInButton>
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
  );
}
