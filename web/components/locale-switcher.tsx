"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({
  compact = false,
  /**
   * Marketing nav bar (Pen LLhzT Lang): text labels, h-7 / px-2.5 / rounded-lg.
   * Default keeps the shared Button sm chrome used elsewhere if ever needed.
   * App chrome uses `compact` and is unchanged.
   */
  appearance = "default",
  className,
}: {
  /** Single control that cycles locales — for collapsed sidebar. */
  compact?: boolean;
  /** `nav` = Pen marketing bar labels; `default` = shared Button sm pills. */
  appearance?: "default" | "nav";
  className?: string;
}) {
  const t = useTranslations("locale");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const languageNames = new Intl.DisplayNames([locale], { type: "language" });

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

  const nav = appearance === "nav";

  return (
    <div
      className={cn(
        "flex items-center",
        nav ? "gap-2" : "gap-0.5",
        className
      )}
      role="group"
      aria-label={t("switch")}
    >
      {routing.locales.map((code) => {
        const active = code === locale;
        return (
          <Button
            key={code}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={active}
            aria-label={languageNames.of(code) ?? t(code)}
            className={
              nav
                ? cn(
                    "h-7 gap-0 rounded-lg border-transparent bg-transparent px-2.5 text-[13px] hover:bg-muted",
                    active
                      ? "font-semibold text-foreground"
                      : "font-normal text-muted-foreground"
                  )
                : active
                  ? "text-foreground"
                  : "text-muted-foreground"
            }
            onClick={() => switchTo(code)}
          >
            {t(code)}
          </Button>
        );
      })}
    </div>
  );
}
