"use client";

import { useTranslations } from "next-intl";

import { isOlderRelease } from "./gateway-version-state";

export function GatewayVersion({ installed, available }: { installed?: string | null; available?: string | null }) {
  const t = useTranslations("access");
  if (!installed) return null;
  return <div className="text-xs text-muted-foreground">
    <p>{t("installedVersion", { version: installed })}</p>
    {isOlderRelease(installed, available) ? <p>{t("updateArchiveReminder")}</p> : null}
  </div>;
}
