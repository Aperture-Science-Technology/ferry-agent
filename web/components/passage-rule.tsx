import { cn } from "@/lib/utils";

/**
 * Recurring editorial “passage” mark: short ink rule (transit / page turn).
 * Prefer this over decorative gradients on marketing and section titles.
 */
export function PassageRule({
  className,
  tone = "accent",
}: {
  className?: string;
  tone?: "accent" | "ink" | "muted";
}) {
  const toneClass =
    tone === "accent"
      ? "bg-primary"
      : tone === "ink"
        ? "bg-foreground"
        : "bg-border";

  return (
    <div
      aria-hidden
      className={cn("h-px w-14", toneClass, className)}
    />
  );
}
