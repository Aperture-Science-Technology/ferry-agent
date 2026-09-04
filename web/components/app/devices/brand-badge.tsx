"use client";

import { Tablet } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { DeviceBrand } from "@/lib/types";

const MARK_CLASS =
  "inline-flex h-5 min-w-5 shrink-0 items-center justify-center overflow-hidden rounded-full";

function BrandMark({ brand }: { brand: DeviceBrand }) {
  switch (brand) {
    case "kindle":
      return (
        <span className={cn(MARK_CLASS, "bg-white px-1")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brands/kindle.svg" alt="" className="h-2.5 w-auto" />
        </span>
      );
    case "kobo":
      return (
        <span className={cn(MARK_CLASS, "bg-white p-1")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brands/kobo.svg" alt="" className="h-3 w-auto" />
        </span>
      );
    case "tolino":
      return (
        <span className={cn(MARK_CLASS, "bg-white px-1.5")}>
          <span className="text-[9px] font-semibold tracking-tight whitespace-nowrap text-neutral-900 lowercase">
            tolino
          </span>
        </span>
      );
    case "pocketbook":
      return (
        <span className={cn(MARK_CLASS, "bg-white px-1.5")}>
          <span className="text-[9px] font-bold tracking-tight whitespace-nowrap text-neutral-900">
            PocketBook
          </span>
        </span>
      );
    case "other":
    default:
      return (
        <span className={cn(MARK_CLASS, "bg-muted text-foreground")}>
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
