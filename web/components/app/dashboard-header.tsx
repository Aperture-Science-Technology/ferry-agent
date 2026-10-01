"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Shell header: one h-16 row with SidebarTrigger (28) + vertical separator,
 * so the inset offcanvas sidebar can reopen on desktop. Title is omitted when
 * the route owns Header/Page (first content block).
 */
export function DashboardHeader() {
  const pathname = usePathname();
  const tNav = useTranslations("nav");

  const pageOwnsHeader =
    pathname?.startsWith("/app/bibliotheque") ||
    pathname?.startsWith("/app/livraisons") ||
    pathname?.startsWith("/app/appareils") ||
    pathname?.startsWith("/app/gateways") ||
    pathname?.startsWith("/app/sources") ||
    pathname?.startsWith("/app/reglages");

  if (pageOwnsHeader) {
    return (
      <header
        data-testid="dashboard-shell-header"
        className="hidden h-16 shrink-0 items-center gap-2 px-4 md:flex"
      >
        <SidebarTrigger className="size-7 rounded-sm" />
        <Separator
          orientation="vertical"
          className="h-4 self-center data-vertical:h-4 data-vertical:self-center"
        />
      </header>
    );
  }

  const title = tNav("dashboard");

  return (
    <header className="flex h-[88px] shrink-0 items-center gap-2 px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <SidebarTrigger className="hidden size-7 rounded-sm md:inline-flex" />
      <Separator
        orientation="vertical"
        className="hidden h-4 self-center data-vertical:h-4 data-vertical:self-center md:block"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="truncate text-[28px] font-bold text-foreground">
          <span className="sr-only">{tNav("dashboard")} — </span>
          {title}
        </h1>
      </div>
    </header>
  );
}
