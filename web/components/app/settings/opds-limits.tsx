"use client";

import { useLocale, useTranslations } from "next-intl";
import type { OpdsToken } from "@/lib/types";
import { formatTokenLastUsed } from "./settings-state";

export function parseOptionalLimit(value: string, maximum: number): number | null | undefined {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : undefined;
}

export function OpdsTokenUsage({ token }: { token: OpdsToken }) {
  const t = useTranslations("settings.readerCatalog");
  const locale = useLocale();
  return <>
    <p>{token.max_downloads == null
      ? t("downloadsUnlimited", { count: token.downloads_count ?? 0 })
      : t("downloadsLimited", { count: token.downloads_count ?? 0, max: token.max_downloads })}</p>
    <p>{token.expires_at
      ? t("expiresOn", { date: formatTokenLastUsed(token.expires_at, locale, token.expires_at) })
      : t("noExpiration")}</p>
  </>;
}
