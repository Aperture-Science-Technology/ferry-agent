"use client";

import { useEffect, useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import {
  BookOpen,
  Cable,
  ChevronsUpDown,
  Database,
  Ellipsis,
  Languages,
  Library,
  Settings,
  Tablet,
  Truck,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
  {
    href: "/docs" as const,
    labelKey: "docs" as const,
    icon: BookOpen,
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

/**
 * Space reserved under page content so the fixed MobileBottomNav never covers
 * the last rows. Tabs are h 72; nav also has a 1px top border, then safe-area
 * padding. Mobile only — desktop resets to 0. Apply on the content shell
 * (`main` / inset), not via overflow clipping.
 */
export const mobileNavContentPadClass =
  "pb-[calc(4.5rem+1px+env(safe-area-inset-bottom,0px))] md:pb-0";

/**
 * Pen Shell/MobileBottomNav + MobileMoreSheet (ba89b7b).
 * Fixed bottom tabs (h 72); Plus opens more sheet.
 */
export function AppMobileNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const locale = useLocale();
  const { user } = useUser();
  const keyboardOpen = useKeyboardOpen();
  const [moreOpen, setMoreOpen] = useState(false);

  const displayName =
    user?.fullName?.trim() ||
    user?.firstName?.trim() ||
    user?.primaryEmailAddress?.emailAddress ||
    t("account");
  const email =
    user?.primaryEmailAddress?.emailAddress?.trim() || t("account");

  const moreActive =
    MORE_LINKS.some((item) => pathname?.startsWith(item.href)) ||
    Boolean(pathname?.startsWith("/docs"));

  return (
    <>
      <nav
        aria-label={t("dashboard")}
        data-testid="app-mobile-bottom-nav"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background md:hidden",
          "pb-[max(0px,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out",
          "motion-reduce:transition-none",
          keyboardOpen && "translate-y-full"
        )}
      >
        {/* Pen SC5Ea: h 72, gap 4, pad [8, 12, 16, 12] */}
        <ul
          data-testid="app-mobile-bottom-nav-tabs"
          className="grid h-[72px] grid-cols-4 gap-1 px-3 pt-2 pb-4"
        >
          {PRIMARY.map((item) => {
            const active = Boolean(pathname?.startsWith(item.href));
            const Icon = item.icon;
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  className={cn(
                    "flex h-full w-full min-w-0 flex-col items-center justify-center gap-1 rounded-sm px-1 text-xs font-medium",
                    active
                      ? "bg-sidebar-accent text-foreground"
                      : "bg-transparent text-muted-foreground"
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
                "flex h-full w-full min-w-0 flex-col items-center justify-center gap-1 rounded-sm px-1 text-xs font-medium",
                moreActive || moreOpen
                  ? "bg-sidebar-accent text-foreground"
                  : "bg-transparent text-muted-foreground"
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
          className="flex max-h-[min(520px,100dvh)] flex-col gap-2 rounded-t-[15px] border border-border bg-card-solid p-0 [&>button]:hidden"
        >
          {/* Pen f8zN3: pad [20, 20, 24, 20], gap 8 */}
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 pt-5 pb-6">
            <div className="flex justify-center pb-2">
              <span
                className="h-1 w-10 rounded-[2px] bg-white/20"
                aria-hidden
              />
            </div>
            <SheetTitle className="text-lg font-medium text-foreground">
              {t("more")}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t("moreDescription")}
            </SheetDescription>

            <ul className="flex flex-col gap-0">
              {MORE_LINKS.map((item) => {
                const active = Boolean(pathname?.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex w-full min-w-0 items-center gap-3 rounded-sm px-3 py-3.5 text-base font-medium",
                        active
                          ? "bg-sidebar-accent text-foreground"
                          : "text-foreground"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon
                        className={cn(
                          "size-[18px] shrink-0",
                          active ? "text-foreground" : "text-muted-foreground"
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 truncate">{t(item.labelKey)}</span>
                    </Link>
                  </li>
                );
              })}

              <li>
                <div className="flex w-full min-w-0 items-center gap-3 rounded-sm px-3 py-3.5">
                  <Languages
                    className="size-[18px] shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-base font-medium text-foreground">
                    {t("language")}
                  </span>
                  {/* Single visible locale value — no FR · EN pair. */}
                  <LocaleSwitcher compact />
                </div>
              </li>
            </ul>

            <div className="h-px w-full bg-border" aria-hidden />

            <div className="flex w-full min-w-0 items-center gap-2.5 rounded-md bg-sidebar-accent p-3">
              <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-avatar">
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "size-8",
                      userButtonTrigger: "size-8",
                    },
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {displayName}
                </p>
                <p className="truncate text-xs font-medium text-muted-foreground">
                  {email} · {locale.toUpperCase()}
                </p>
              </div>
              <ChevronsUpDown
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
