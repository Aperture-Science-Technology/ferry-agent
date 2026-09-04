import { cn } from "@/lib/utils";

/**
 * Simplified "kobo" wordmark, inspired by the Kobo e-reader branding
 * (lowercase, extra-bold, rounded sans-serif).
 */
export function KoboLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 68 32"
      aria-hidden="true"
      className={cn("h-3.5 w-auto", className)}
    >
      <text
        x="1"
        y="24"
        fontFamily="ui-rounded, ui-sans-serif, system-ui, sans-serif"
        fontSize="26"
        fontWeight="800"
        letterSpacing="-1"
        fill="currentColor"
      >
        kobo
      </text>
    </svg>
  );
}
