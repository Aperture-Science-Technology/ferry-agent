"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { DeviceBrand } from "@/lib/types";

const MONOGRAMS: Record<DeviceBrand, string> = {
  kindle: "K",
  kobo: "Ko",
  tolino: "T",
  pocketbook: "PB",
  other: "?",
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
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
        {MONOGRAMS[brand]}
      </span>
      {showLabel && <span>{t(`brands.${brand}`)}</span>}
    </span>
  );
}
