import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PassageRule } from "@/components/passage-rule";
import { cn } from "@/lib/utils";

/**
 * Full-width status surface for loading / empty / soft-error states.
 * Editorial paper plane — not a decorative SaaS card.
 */
export function StatePanel({
  icon: Icon,
  visual,
  title,
  description,
  action,
  className,
  children,
}: {
  icon?: LucideIcon;
  /** Prefer over icon for branded empty states; keep decorative (alt="") when title is present. */
  visual?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative px-5 py-12 text-center sm:px-8 sm:py-14",
        "border border-border/80 bg-muted/25",
        "rounded-lg",
        className
      )}
    >
      <div className="relative mx-auto flex max-w-md flex-col items-center gap-3">
        <PassageRule tone="accent" className="mb-1 w-12" />
        {visual ? <div className="mb-1">{visual}</div> : null}
        {!visual && Icon ? (
          <Icon className="size-7 text-muted-foreground" aria-hidden />
        ) : null}
        {title ? (
          <p className="font-heading text-lg font-medium tracking-tight text-balance">
            {title}
          </p>
        ) : null}
        {description ? (
          <p className="min-w-0 text-sm leading-relaxed whitespace-normal text-muted-foreground">
            {description}
          </p>
        ) : null}
        {children}
        {action ? <div className="mt-2 flex min-w-0 flex-wrap justify-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}
