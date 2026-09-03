"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

export function LocaleSwitcher() {
  const t = useTranslations("locale");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next === locale) return;
    router.replace(pathname, { locale: next });
  }

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={t("switch")}>
      {routing.locales.map((code) => (
        <Button
          key={code}
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={code === locale}
          className={code === locale ? "text-foreground" : "text-muted-foreground"}
          onClick={() => switchTo(code)}
        >
          {t(code)}
        </Button>
      ))}
    </div>
  );
}
