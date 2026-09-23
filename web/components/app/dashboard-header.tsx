"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";

/**
 * Shell strip for routes that do not own Header/Page.
 * Library owns ePLzB / mF0028 titles — never double the heading.
 */
export function DashboardHeader() {
  const pathname = usePathname();
  const tPages = useTranslations("pages");
  const tNav = useTranslations("nav");

  if (
    pathname?.startsWith("/app/bibliotheque") ||
    pathname?.startsWith("/app/gateways") ||
    pathname?.startsWith("/app/sources") ||
    pathname?.startsWith("/app/reglages")
  ) {
    return null;
  }

  let title = tNav("dashboard");
  if (pathname?.startsWith("/app/livraisons"))
    title = tPages("deliveries.title");
  else if (pathname?.startsWith("/app/appareils"))
    title = tPages("devices.title");

  return (
    <header className="flex h-[72px] shrink-0 items-center gap-4 px-5 pt-[env(safe-area-inset-top)] md:px-10">
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-heading text-lg font-medium text-foreground">
          <span className="sr-only">{tNav("dashboard")} — </span>
          {title}
        </h1>
      </div>
    </header>
  );
}
