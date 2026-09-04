import { cn } from "@/lib/utils";

/**
 * Simplified "kindle" wordmark, inspired by the Amazon Kindle device
 * branding (lowercase, bold, tightly tracked sans-serif).
 */
export function KindleLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 32"
      aria-hidden="true"
      className={cn("h-3.5 w-auto", className)}
    >
      <text
        x="1"
        y="24"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="26"
        fontWeight="700"
        letterSpacing="-1"
        fill="currentColor"
      >
        kindle
      </text>
    </svg>
  );
}
