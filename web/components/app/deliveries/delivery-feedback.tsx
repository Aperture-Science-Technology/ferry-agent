import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Pen Feedback strip for deliveries partial/refresh — surface card, r md, pad 16, gap 12.
 * Same grammar as library lot; no PassageRule / StatePanel.
 */
export function DeliveryFeedback({
  icon: Icon,
  iconClassName,
  title,
  description,
  action,
  role = "status",
  className,
  children,
}: {
  icon?: LucideIcon;
  iconClassName?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  role?: "status" | "alert";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={role}
      className={cn(
        "flex items-center gap-3 rounded-md border border-border bg-card p-4",
        className
      )}
    >
      {Icon ? (
        <Icon
          className={cn("size-[18px] shrink-0 text-foreground", iconClassName)}
          aria-hidden
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="text-xs font-medium text-muted-foreground">
            {description}
          </p>
        ) : null}
        {children}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Pen empty / unavailable — centered Fraunces 18 + 14 body (library EmptyState grammar).
 */
export function DeliveryEmpty({
  icon: Icon,
  title,
  description,
  action,
  role,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  role?: "status" | "alert";
}) {
  return (
    <div
      role={role}
      className="flex flex-col items-center justify-center gap-3 px-8 py-8 text-center"
    >
      <Icon className="size-7 text-muted-foreground" aria-hidden />
      <p className="font-heading text-lg font-medium text-foreground text-balance">
        {title}
      </p>
      {description ? (
        <p className="max-w-md text-sm font-medium text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="mt-1 flex min-w-0 flex-wrap justify-center gap-2">
          {action}
        </div>
      ) : null}
    </div>
  );
}
