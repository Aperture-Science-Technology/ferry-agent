"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * Torrents via Gateway — ferry-surface card, title 16 + muted 12 + Ghost CTA.
 */
export function GatewayTorrentAction() {
  const t = useTranslations("access");

  return (
    <div
      data-testid="gateway-torrent-action"
      className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border-strong bg-ferry-surface p-5"
    >
      <p className="text-base font-medium break-words whitespace-normal text-foreground">
        {t("torrentActionTitle")}
      </p>
      <p className="text-xs font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
        {t("torrentActionDescription")}
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 w-fit min-w-0 whitespace-normal"
        render={<Link href="/app/sources">{t("torrentActionCta")}</Link>}
      />
    </div>
  );
}
