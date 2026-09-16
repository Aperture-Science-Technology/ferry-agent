"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  Database,
  Ellipsis,
  Library,
  Radio,
  Send,
  Settings,
  Tablet,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const PRIMARY = [
  {
    href: "/app/bibliotheque" as const,
    labelKey: "library" as const,
    icon: Library,
  },
  {
    href: "/app/livraisons" as const,
    labelKey: "deliveries" as const,
    icon: Send,
  },
  {
    href: "/app/appareils" as const,
    labelKey: "devices" as const,
    icon: Tablet,
  },
];

const MORE_LINKS = [
  {
    href: "/app/gateways" as const,
    labelKey: "access" as const,
    icon: Radio,
  },
  {
    href: "/app/sources" as const,
    labelKey: "sources" as const,
    icon: Database,
  },
  {
    href: "/app/reglages" as const,
    labelKey: "settings" as const,
    icon: Settings,
  },
];

function useKeyboardOpen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      const obscured = window.innerHeight - viewport.height > 120;
      setOpen(obscured);
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return open;
}

export function AppMobileNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const keyboardOpen = useKeyboardOpen();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive =
    MORE_LINKS.some((item) => pathname?.startsWith(item.href)) ||
    Boolean(pathname?.startsWith("/docs"));

  return (
    <>
      <nav
        aria-label={t("dashboard")}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-md md:hidden",
          "pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out",
          "motion-reduce:transition-none",
          keyboardOpen && "translate-y-full"
        )}
      >
        <ul className="grid grid-cols-4 gap-1 px-2 pt-1.5">
          {PRIMARY.map((item) => {
            const active = Boolean(pathname?.startsWith(item.href));
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-auto w-full flex-col gap-1 rounded-md px-1 py-2 text-[0.6875rem] font-medium",
                    active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-5" aria-hidden />
                  <span className="truncate">{t(item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-auto w-full flex-col gap-1 rounded-md px-1 py-2 text-[0.6875rem] font-medium",
                moreActive || moreOpen
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground"
              )}
              aria-expanded={moreOpen}
              aria-controls="app-mobile-more"
              onClick={() => setMoreOpen(true)}
            >
              <Ellipsis className="size-5" aria-hidden />
              <span className="truncate">{t("more")}</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          id="app-mobile-more"
          side="bottom"
          className="h-[100dvh] max-h-[100dvh] gap-0 rounded-none p-0"
        >
          <SheetHeader className="border-b border-border/70 px-5 py-4 text-left">
            <SheetTitle className="font-heading text-xl">
              {t("moreMenu")}
            </SheetTitle>
            <SheetDescription>{t("moreDescription")}</SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
            <p className="mb-2 px-2 text-[0.6875rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              {t("groupLocal")}
            </p>
            <ul className="flex flex-col gap-1">
              {MORE_LINKS.map((item) => {
                const active = Boolean(pathname?.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        buttonVariants({ variant: "ghost" }),
                        "h-11 w-full justify-start gap-3 rounded-md px-3 text-sm",
                        active && "bg-accent font-medium text-foreground"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="size-4" aria-hidden />
                      {t(item.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="my-4 h-px bg-border/80" />

            <ul className="flex flex-col gap-1">
              <li>
                <Link
                  href="/docs"
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-11 w-full justify-start gap-3 rounded-md px-3 text-sm",
                    pathname?.startsWith("/docs") &&
                      "bg-accent font-medium text-foreground"
                  )}
                >
                  <BookOpen className="size-4" aria-hidden />
                  {t("docs")}
                </Link>
              </li>
            </ul>

            <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/70 px-2 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <LocaleSwitcher />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {t("account")}
                </span>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "size-8",
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
