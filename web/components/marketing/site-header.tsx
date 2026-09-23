"use client";

import { useState } from "react";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { BrandLogo } from "@/components/brand-logo";
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

export function SiteHeader() {
  const t = useTranslations("header");
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex min-w-0 shrink items-center rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <BrandLogo />
        </Link>

        <nav
          className="hidden items-center gap-8 text-sm text-muted-foreground md:flex"
          aria-label={t("primaryNav")}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className="rounded-sm transition-colors duration-125 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <LocaleSwitcher className="hidden sm:flex" />
          <LocaleSwitcher compact className="sm:hidden" />

          <div className="hidden items-center gap-2 sm:flex">
            <Show when="signed-out">
              <SignInButton>
                <Button
                  variant="ghost"
                  size="sm"
                  className="transition-colors duration-125"
                >
                  {t("signIn")}
                </Button>
              </SignInButton>
              <SignInButton>
                <Button size="sm" className="transition-colors duration-125">
                  {t("openDashboard")}
                </Button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <Button
                size="sm"
                className="transition-colors duration-125"
                render={
                  <Link href="/app/bibliotheque">{t("dashboard")}</Link>
                }
              />
              <UserButton />
            </Show>
          </div>

          <Show when="signed-in">
            <div className="sm:hidden">
              <UserButton />
            </div>
          </Show>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="md:hidden transition-colors duration-125"
                  aria-expanded={menuOpen}
                  aria-controls="site-header-mobile-nav"
                />
              }
            >
              <MenuIcon className="size-4" aria-hidden />
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
                    className="rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors duration-125 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    onClick={closeMenu}
                  >
                    {t(link.key)}
                  </Link>
                ))}
              </nav>
              <div className="mt-auto space-y-2 border-t border-border p-4 sm:hidden">
                <Show when="signed-out">
                  <SignInButton>
                    <Button
                      variant="outline"
                      className="w-full transition-colors duration-125"
                      onClick={closeMenu}
                    >
                      {t("signIn")}
                    </Button>
                  </SignInButton>
                  <SignInButton>
                    <Button
                      className="w-full transition-colors duration-125"
                      onClick={closeMenu}
                    >
                      {t("openDashboard")}
                    </Button>
                  </SignInButton>
                </Show>
                <Show when="signed-in">
                  <Button
                    className="w-full transition-colors duration-125"
                    render={
                      <Link href="/app/bibliotheque" onClick={closeMenu}>
                        {t("dashboard")}
                      </Link>
                    }
                  />
                </Show>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
