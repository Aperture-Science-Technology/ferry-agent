"use client";

import type { ComponentType } from "react";
import { Tablet } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { DeviceBrand } from "@/lib/types";
import { KindleLogo } from "@/components/app/devices/kindle-logo";
import { KoboLogo } from "@/components/app/devices/kobo-logo";
import { TolinoLogo } from "@/components/app/devices/tolino-logo";
import { PocketBookLogo } from "@/components/app/devices/pocketbook-logo";

const BRAND_LOGOS: Record<DeviceBrand, ComponentType<{ className?: string }>> = {
  kindle: KindleLogo,
  kobo: KoboLogo,
  tolino: TolinoLogo,
  pocketbook: PocketBookLogo,
  other: Tablet,
};

export function BrandBadge({
  brand,
  showLabel = true,
  className,
}: {
  brand: DeviceBrand;
  showLabel?: boolean;
  className?: string;
}) {
  const t = useTranslations("newDevice");
  const Logo = BRAND_LOGOS[brand];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-muted px-0.5 text-foreground">
        <Logo className="h-3.5 w-auto" />
      </span>
      {showLabel && <span>{t(`brands.${brand}`)}</span>}
    </span>
  );
}
