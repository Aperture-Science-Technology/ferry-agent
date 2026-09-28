"use client";

import type { ReactElement } from "react";
import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function localeDisplayName(
  code: Locale,
  tSettings: ReturnType<typeof useTranslations<"settings">>
) {
  return code === "en"
    ? tSettings("languageValueEn")
    : tSettings("languageValueFr");
}

/**
 * Explicit FR / EN pair for the marketing header (desktop).
 * Each button applies its locale directly — no cycling.
 */
export function LocalePair({ className }: { className?: string }) {
  const t = useTranslations("locale");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next === locale) return;
    router.replace(pathname, { locale: next });
  }

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role="group"
      aria-label={t("choose")}
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

/**
 * Explicit language picker (Pen Row/Langue + mobile Sheet/Langue).
 * First interaction opens the menu; locale changes only on a radio choice.
 */
export function LocaleMenu({
  className,
  showBorder = true,
  trigger,
}: {
  className?: string;
  /** Preferences row border under the trigger (settings card). */
  showBorder?: boolean;
  /** Custom trigger (e.g. mobile More sheet row). Defaults to preferences row. */
  trigger?: ReactElement;
}) {
  const tLocale = useTranslations("locale");
  const tSettings = useTranslations("settings");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  function selectLocale(next: string) {
    if (next === locale) return;
    if (!routing.locales.includes(next as Locale)) return;
    router.replace(pathname, { locale: next as Locale });
  }

  return (
    <DropdownMenu>
      {trigger ? (
        <DropdownMenuTrigger
          render={trigger}
          aria-label={tLocale("choose")}
        />
      ) : (
        <DropdownMenuTrigger
          className={cn(
            "flex w-full min-w-0 items-center gap-4 py-4 text-left",
            showBorder && "border-b border-border",
            "rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            className
          )}
          aria-label={tLocale("choose")}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-foreground">
              {tSettings("languageLabel")}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {localeDisplayName(locale, tSettings)}
            </span>
          </div>
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="start" className="w-auto min-w-44 max-w-55">
        <DropdownMenuRadioGroup value={locale} onValueChange={selectLocale}>
          {routing.locales.map((code) => (
            <DropdownMenuRadioItem key={code} value={code} closeOnClick>
              {localeDisplayName(code, tSettings)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
