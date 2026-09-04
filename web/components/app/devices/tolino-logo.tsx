import { cn } from "@/lib/utils";

/**
 * Simplified "tolino" wordmark, inspired by the tolino e-reader branding
 * (lowercase, medium-weight, rounded geometric sans-serif).
 */
export function TolinoLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 32"
      aria-hidden="true"
      className={cn("h-3.5 w-auto", className)}
    >
      <text
        x="1"
        y="24"
        fontFamily="ui-rounded, ui-sans-serif, system-ui, sans-serif"
        fontSize="26"
        fontWeight="600"
        letterSpacing="-0.5"
        fill="currentColor"
      >
        tolino
      </text>
    </svg>
  );
}
