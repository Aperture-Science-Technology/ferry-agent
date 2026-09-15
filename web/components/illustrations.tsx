import { cn } from "@/lib/utils";

type IllustrationProps = {
  className?: string;
  /** Decorative by default — pair with adjacent HTML copy. */
  alt?: string;
};

/**
 * Proprietary 2D empty-state illustration for the online library.
 * Keep adjacent title/description in HTML (next-intl); this asset is decorative.
 */
export function EmptyLibraryIllustration({
  className,
  alt = "",
}: IllustrationProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG asset; no raster optimization needed
    <img
      src="/illustrations/empty-library.svg"
      alt={alt}
      width={160}
      height={120}
      className={cn("mx-auto h-auto w-[160px] max-w-full", className)}
      decoding="async"
    />
  );
}

/**
 * Cloud service (left) and local Gateway module (right).
 * Zone labels must stay in HTML — the SVG contains no FR/EN text.
 */
export function CloudGatewayIllustration({
  className,
  alt = "",
}: IllustrationProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG asset; no raster optimization needed
    <img
      src="/illustrations/cloud-gateway.svg"
      alt={alt}
      width={200}
      height={120}
      className={cn("mx-auto h-auto w-[200px] max-w-full", className)}
      decoding="async"
    />
  );
}
