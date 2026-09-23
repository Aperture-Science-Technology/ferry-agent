import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Section title — Pen “Récents” style (14/500 muted) or stronger when needed.
 * No decorative passage rule (removed from Pen product screens).
 */
export function SectionHeader({
  title,
  description,
  action,
  className,
  muted = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-start justify-between gap-3",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <h2
          className={cn(
            "font-medium text-balance",
            muted
              ? "text-sm text-muted-foreground"
              : "font-heading text-lg text-foreground"
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-xs font-medium text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}
