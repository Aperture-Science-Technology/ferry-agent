"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";

/**
 * Shell strip for routes that do not own Header/Page.
 * Library and Deliveries (and gateways/sources/settings) own their titles — never double.
 */
export function DashboardHeader() {
  const pathname = usePathname();
  const tPages = useTranslations("pages");
  const tNav = useTranslations("nav");

  if (
    pathname?.startsWith("/app/bibliotheque") ||
    pathname?.startsWith("/app/livraisons") ||
    pathname?.startsWith("/app/gateways") ||
    pathname?.startsWith("/app/sources") ||
    pathname?.startsWith("/app/reglages")
  ) {
    return null;
  }

  let title = tNav("dashboard");
  if (pathname?.startsWith("/app/appareils"))
    title = tPages("devices.title");

  return (
    <header className="flex h-[88px] shrink-0 items-center gap-4 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:px-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="truncate text-[28px] font-bold text-foreground">
          <span className="sr-only">{tNav("dashboard")} — </span>
          {title}
        </h1>
      </div>
    </header>
  );
}
