"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export function DashboardHeader() {
  const pathname = usePathname();
  const tPages = useTranslations("pages");
  const tNav = useTranslations("nav");

  let title = tNav("dashboard");
  if (pathname?.startsWith("/app/bibliotheque")) title = tPages("library.title");
  else if (pathname?.startsWith("/app/livraisons"))
    title = tPages("deliveries.title");
  else if (pathname?.startsWith("/app/appareils"))
    title = tPages("devices.title");
  else if (pathname?.startsWith("/app/gateways")) title = tPages("access.title");
  else if (pathname?.startsWith("/app/sources")) title = tPages("sources.title");
  else if (pathname?.startsWith("/app/reglages"))
    title = tPages("settings.title");

  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b border-border/50 bg-background/90 px-4 backdrop-blur-md md:h-14 md:px-6 lg:px-8">
      <SidebarTrigger className="hidden md:inline-flex" />
      <div className="hidden h-4 items-center md:flex">
        <Separator orientation="vertical" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-muted-foreground">
          <span className="sr-only">{tNav("dashboard")} — </span>
          {title}
        </p>
      </div>
    </header>
  );
}
