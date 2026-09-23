"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  Cable,
  Database,
  Ellipsis,
  Languages,
  Library,
  Settings,
  Tablet,
  Truck,
  User,
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
 * Pen Shell/MobileBottomNav SC5Ea + MobileMoreSheet f8zN3 / SL12k.
 * Fixed bottom tabs; Plus opens full-height sheet (no compressed sidebar).
 */
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
          "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card md:hidden",
          "pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out",
          "motion-reduce:transition-none",
          keyboardOpen && "translate-y-full"
        )}
      >
        {/* Pen SC5Ea: h 72, gap 4, pad [8,8,16,8] */}
        <ul className="grid h-[72px] grid-cols-4 gap-1 px-2 pt-2">
          {PRIMARY.map((item) => {
            const active = Boolean(pathname?.startsWith(item.href));
            const Icon = item.icon;
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  className={cn(
                    "flex h-full w-full min-w-0 flex-col items-center justify-center gap-1 rounded-sm px-1 py-2 text-[11px] font-medium",
                    active
                      ? "bg-accent text-muted-foreground"
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
                "flex h-full w-full min-w-0 flex-col items-center justify-center gap-1 rounded-sm px-1 py-2 text-[11px] font-medium",
                moreActive || moreOpen
                  ? "bg-accent text-muted-foreground"
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
          className="flex h-[100dvh] max-h-[100dvh] flex-col gap-2 rounded-none border-border bg-card p-0 [&>button]:hidden"
        >
          {/* Pen f8zN3: pad [24,24,40,24], gap 8 */}
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-6 pt-6 pb-10">
            <div className="flex justify-center pb-2">
              <span
                className="h-1 w-10 rounded-[2px] bg-border"
                aria-hidden
              />
            </div>
            <SheetTitle className="font-heading text-[22px] font-medium text-foreground">
              {t("moreMenu")}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t("moreDescription")}
            </SheetDescription>

            <ul className="flex flex-col gap-2 pt-2">
              {MORE_LINKS.map((item) => {
                const active = Boolean(pathname?.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex w-full min-w-0 items-center gap-3 rounded-sm px-3 py-3.5 text-base font-medium text-foreground",
                        active && "bg-accent"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="size-[18px] shrink-0" aria-hidden />
                      <span className="min-w-0 truncate">{t(item.labelKey)}</span>
                    </Link>
                  </li>
                );
              })}

              <li>
                <div className="flex w-full min-w-0 items-center gap-3 rounded-sm px-3 py-3.5">
                  <Languages
                    className="size-[18px] shrink-0 text-foreground"
                    aria-hidden
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="text-base font-medium text-foreground">
                      {t("language")}
                    </span>
                    <LocaleSwitcher />
                  </div>
                </div>
              </li>

              <li>
                <div className="flex w-full min-w-0 items-center gap-3 rounded-sm px-3 py-3.5">
                  <User
                    className="size-[18px] shrink-0 text-foreground"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-base font-medium text-foreground">
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
              </li>
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
