"use client";

import { Tablet } from "lucide-react";
import { useTranslations } from "next-intl";
import { KindleLogo, KoboLogo } from "@/components/app/devices/brand-logos";
import { cn } from "@/lib/utils";
import type { DeviceBrand } from "@/lib/types";

const MARK_CLASS =
  "inline-flex h-4 min-w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-foreground";

function BrandMark({ brand }: { brand: DeviceBrand }) {
  switch (brand) {
    case "kindle":
      return (
        <span className={cn(MARK_CLASS, "px-1")}>
          <KindleLogo className="h-2.5 w-auto" />
        </span>
      );
    case "kobo":
      return (
        <span className={cn(MARK_CLASS, "px-1")}>
          <KoboLogo className="h-2.5 w-auto" />
        </span>
      );
    case "tolino":
      return (
        <span className={cn(MARK_CLASS, "px-1.5")}>
          <span className="text-[9px] font-semibold tracking-tight whitespace-nowrap lowercase">
            tolino
          </span>
        </span>
      );
    case "pocketbook":
      return (
        <span className={cn(MARK_CLASS, "px-1.5")}>
          <span className="text-[9px] font-bold tracking-tight whitespace-nowrap">
            PocketBook
          </span>
        </span>
      );
    case "other":
    default:
      return (
        <span className={MARK_CLASS}>
          <Tablet className="h-3 w-3" />
        </span>
      );
  }
}

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
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark brand={brand} />
      {showLabel && <span>{t(`brands.${brand}`)}</span>}
    </span>
  );
}
