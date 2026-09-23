"use client";

import { Tablet } from "lucide-react";
import { useTranslations } from "next-intl";
import { KindleLogo, KoboLogo } from "@/components/app/devices/brand-logos";
import { cn } from "@/lib/utils";
import type { DeviceBrand } from "@/lib/types";

const MARK_CLASS =
  "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-ferry-surface text-foreground";

function BrandMark({
  brand,
  size = "sm",
}: {
  brand: DeviceBrand;
  size?: "sm" | "lg";
}) {
  const box =
    size === "lg"
      ? cn(MARK_CLASS, "size-10")
      : cn(MARK_CLASS, "h-4 min-w-4 rounded-full");
  const logoSm = "h-2.5 w-auto";
  const logoLg = "h-3.5 w-auto max-w-7";
  const logoClass = size === "lg" ? logoLg : logoSm;
  const textClass =
    size === "lg"
      ? "text-[10px] font-semibold tracking-tight"
      : "text-[9px] font-semibold tracking-tight";

  switch (brand) {
    case "kindle":
      return (
        <span className={cn(box, size === "sm" && "px-1")}>
          <KindleLogo className={logoClass} />
        </span>
      );
    case "kobo":
      return (
        <span className={cn(box, size === "sm" && "px-1")}>
          <KoboLogo className={logoClass} />
        </span>
      );
    case "tolino":
      return (
        <span className={cn(box, size === "sm" ? "px-1.5" : "px-1")}>
          <span className={cn(textClass, "whitespace-nowrap lowercase")}>
            tolino
          </span>
        </span>
      );
    case "pocketbook":
      return (
        <span className={cn(box, size === "sm" ? "px-1.5" : "px-1")}>
          <span
            className={cn(
              textClass,
              "font-bold whitespace-nowrap",
              size === "lg" && "text-[9px]"
            )}
          >
            PocketBook
          </span>
        </span>
      );
    case "other":
    default:
      return (
        <span className={box}>
          <Tablet className={size === "lg" ? "h-4 w-4" : "h-3 w-3"} />
        </span>
      );
  }
}

export function BrandBadge({
  brand,
  showLabel = true,
  size = "sm",
  className,
}: {
  brand: DeviceBrand;
  showLabel?: boolean;
  size?: "sm" | "lg";
  className?: string;
}) {
  const t = useTranslations("newDevice");
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <BrandMark brand={brand} size={size} />
      {showLabel ? (
        <span className="min-w-0 break-words whitespace-normal">
          {t(`brands.${brand}`)}
        </span>
      ) : null}
    </span>
  );
}
