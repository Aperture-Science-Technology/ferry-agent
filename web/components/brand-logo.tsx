"use client";

import type { SVGProps } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type BrandMarkProps = SVGProps<SVGSVGElement> & {
  /** When true, hide from assistive tech (parent already names the brand). */
  decorative?: boolean;
};

/**
 * Ferry Agent symbol: open book + transfer arc (passage), not a boat.
 * Uses currentColor so it inherits text color from the surrounding UI.
 */
export function BrandMark({
  decorative = true,
  className,
  ...props
}: BrandMarkProps) {
  const t = useTranslations("brand");
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": t("logoAlt") };

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("size-7 shrink-0", className)}
      {...props}
      {...a11y}
    >
      <path
        fill="currentColor"
        d="M5.5 8.2c0-.7.5-1.2 1.1-1.4 2.9-.8 5.6.1 7.4 1.6.3.3.5.7.5 1.1v14.2c0 .8-.7 1.3-1.4 1.1-2.6-.7-5-.2-7.1 1.1-.5.3-1.1-.1-1.1-.7V8.2Z"
      />
      <path
        fill="currentColor"
        d="M26.5 8.2c0-.7-.5-1.2-1.1-1.4-2.9-.8-5.6.1-7.4 1.6-.3.3-.5.7-.5 1.1v14.2c0 .8.7 1.3 1.4 1.1 2.6-.7 5-.2 7.1 1.1.5.3 1.1-.1 1.1-.7V8.2Z"
      />
      <path
        fill="currentColor"
        fillOpacity={0.4}
        d="M15.2 8.6h1.6v15.2h-1.6z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.9}
        strokeWidth={2.2}
        strokeLinecap="round"
        d="M8.2 15.2c2.4-3.4 5.2-5.1 7.8-5.1s5.4 1.7 7.8 5.1"
      />
      <circle cx="8.2" cy="15.2" r="1.35" fill="currentColor" fillOpacity={0.9} />
      <circle cx="23.8" cy="15.2" r="1.35" fill="currentColor" fillOpacity={0.9} />
    </svg>
  );
}

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  /** Show the wordmark next to the symbol (default). */
  withWordmark?: boolean;
  /** When true, mark is decorative; the wordmark (or parent) provides the name. */
  decorative?: boolean;
};

/**
 * Reusable Ferry Agent brand lockup for headers, sidebar and footer.
 * Wordmark uses the product heading font; symbol is inline SVG (no icon library).
 */
export function BrandLogo({
  className,
  markClassName,
  withWordmark = true,
  decorative = true,
}: BrandLogoProps) {
  const t = useTranslations("brand");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-foreground",
        className
      )}
    >
      <BrandMark
        decorative={decorative || withWordmark}
        className={markClassName}
      />
      {withWordmark ? (
        <span className="font-heading text-lg font-semibold tracking-tight">
          {t("name")}
        </span>
      ) : null}
    </span>
  );
}
