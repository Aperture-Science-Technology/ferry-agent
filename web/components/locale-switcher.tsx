"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({
  compact = false,
  className,
}: {
  /** Single control that cycles locales — for collapsed sidebar. */
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("locale");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next === locale) return;
    router.replace(pathname, { locale: next });
  }

  function cycle() {
    const index = routing.locales.indexOf(locale as Locale);
    const next = routing.locales[(index + 1) % routing.locales.length];
    switchTo(next);
  }

  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn("text-muted-foreground", className)}
        aria-label={t("switch")}
        title={t("switch")}
        onClick={cycle}
      >
        {t(locale as Locale)}
      </Button>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role="group"
      aria-label={t("switch")}
    >
      {routing.locales.map((code) => (
        <Button
          key={code}
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={code === locale}
          className={
            code === locale ? "text-foreground" : "text-muted-foreground"
          }
          onClick={() => switchTo(code)}
        >
          {t(code)}
        </Button>
      ))}
    </div>
  );
}
