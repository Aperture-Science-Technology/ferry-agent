"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  Cable,
  Database,
  Ellipsis,
  Library,
  Settings,
  Tablet,
  Truck,
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
    icon: Truck,
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
    icon: Cable,
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
          "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md md:hidden",
          "pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out",
          "motion-reduce:transition-none",
          keyboardOpen && "translate-y-full"
        )}
      >
        <ul className="grid h-[72px] grid-cols-4 gap-1 px-2 pt-2">
          {PRIMARY.map((item) => {
            const active = Boolean(pathname?.startsWith(item.href));
            const Icon = item.icon;
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-auto w-full min-w-0 flex-col gap-1 rounded-sm px-1 py-2 text-[0.6875rem] font-medium",
                    active
                      ? "bg-sidebar-accent text-foreground"
                      : "text-muted-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <span className="max-w-full truncate">{t(item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
          <li className="min-w-0">
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-auto w-full min-w-0 flex-col gap-1 rounded-sm px-1 py-2 text-[0.6875rem] font-medium",
                moreActive || moreOpen
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground"
              )}
              aria-expanded={moreOpen}
              aria-controls="app-mobile-more"
              aria-haspopup="dialog"
              onClick={() => setMoreOpen(true)}
            >
              <Ellipsis className="size-5 shrink-0" aria-hidden />
              <span className="max-w-full truncate">{t("more")}</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          id="app-mobile-more"
          side="bottom"
          className="flex h-[100dvh] max-h-[100dvh] flex-col gap-0 rounded-none p-0"
        >
          <SheetHeader className="shrink-0 border-b border-border px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4 text-left">
            <SheetTitle className="font-heading text-xl font-medium">
              {t("moreMenu")}
            </SheetTitle>
            <SheetDescription>{t("moreDescription")}</SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
            <p className="mb-2 px-3 text-[11px] font-medium text-muted-foreground">
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
                        "h-auto w-full min-w-0 justify-start gap-2.5 rounded-sm px-3 py-2.5 text-sm font-medium",
                        active && "bg-sidebar-accent text-foreground"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span className="min-w-0 truncate">{t(item.labelKey)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="my-4 h-px bg-border" />

            <ul className="flex flex-col gap-1">
              <li>
                <Link
                  href="/docs"
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-auto w-full min-w-0 justify-start gap-2.5 rounded-sm px-3 py-2.5 text-sm font-medium",
                    pathname?.startsWith("/docs") &&
                      "bg-sidebar-accent text-foreground"
                  )}
                  aria-current={
                    pathname?.startsWith("/docs") ? "page" : undefined
                  }
                >
                  <BookOpen className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate">{t("docs")}</span>
                </Link>
              </li>
            </ul>

            <div className="mt-auto flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border px-2 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("language")}
                </span>
                <LocaleSwitcher />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {t("account")}
                </span>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "size-7",
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
