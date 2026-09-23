"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * Pen L00010 Gateway actions row — surface, pad 16, gap 6, r md, border.
 * Not a SaaS card grid; title 16 + muted 12 + CTA.
 */
export function GatewayTorrentAction() {
  const t = useTranslations("access");

  return (
    <div
      data-testid="gateway-torrent-action"
      className="flex min-w-0 flex-col gap-1.5 rounded-md border border-border bg-card p-4"
    >
      <p className="text-base font-medium break-words whitespace-normal text-foreground">
        {t("torrentActionTitle")}
      </p>
      <p className="text-xs font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
        {t("torrentActionDescription")}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-2 w-fit min-w-0 whitespace-normal rounded-md"
        render={<Link href="/app/sources">{t("torrentActionCta")}</Link>}
      />
    </div>
  );
}
