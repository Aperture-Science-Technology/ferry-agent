"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Shell strip: always hosts SidebarTrigger so the inset offcanvas sidebar can
 * reopen on desktop. Title is omitted when the route owns Header/Page.
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
      <div className="hidden shrink-0 items-center gap-4 p-2 md:flex md:px-2">
        <SidebarTrigger />
      </div>
    );
  }

  const title = tNav("dashboard");

  return (
    <header className="flex h-[88px] shrink-0 items-center gap-4 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:px-2">
      <SidebarTrigger className="hidden md:inline-flex" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="truncate text-[28px] font-bold text-foreground">
          <span className="sr-only">{tNav("dashboard")} — </span>
          {title}
        </h1>
      </div>
    </header>
  );
}
