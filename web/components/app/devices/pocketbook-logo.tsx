import { cn } from "@/lib/utils";

/**
 * Simplified "PocketBook" wordmark with the brand's star accent,
 * inspired by the PocketBook e-reader branding.
 */
export function PocketBookLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 32"
      aria-hidden="true"
      className={cn("h-3.5 w-auto", className)}
    >
      <path
        d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"
        fill="currentColor"
        transform="translate(2 6) scale(0.83)"
      />
      <text
        x="26"
        y="23"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="24"
        fontWeight="700"
        letterSpacing="-0.5"
        fill="currentColor"
      >
        PocketBook
      </text>
    </svg>
  );
}
