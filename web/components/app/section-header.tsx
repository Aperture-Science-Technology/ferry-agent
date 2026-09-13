import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Section title with the Ferry “passage” accent (teal→sky liseré).
 * Reusable across app screens.
 */
export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-wrap items-start justify-between gap-3",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-2 h-px w-16 bg-gradient-to-r from-chart-1 via-chart-2 to-transparent" />
        <h2 className="font-heading text-lg font-medium tracking-tight text-balance">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
