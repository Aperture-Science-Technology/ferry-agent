import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Full-width status surface for loading / empty / soft-error states.
 */
export function StatePanel({
  icon: Icon,
  title,
  description,
  action,
  className,
  children,
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-dashed border-border/70 bg-card/40 px-6 py-14 text-center",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-chart-1/50 to-transparent"
      />
      <div className="relative mx-auto flex max-w-md flex-col items-center gap-3">
        {Icon ? (
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted/60 ring-1 ring-border/50">
            <Icon className="size-5 text-chart-1" />
          </div>
        ) : null}
        {title ? (
          <p className="font-heading text-base font-medium tracking-tight">{title}</p>
        ) : null}
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
        {children}
        {action ? <div className="mt-1">{action}</div> : null}
      </div>
    </div>
  );
}
