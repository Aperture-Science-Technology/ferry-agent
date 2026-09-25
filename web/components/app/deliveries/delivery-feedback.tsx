import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pen Feedback / Queue hint — ferry-surface, radius-md, pad 16, gap 12, border.
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
  ...rest
}: {
  icon?: LucideIcon;
  iconClassName?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  role?: "status" | "alert";
  className?: string;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role={role}
      className={cn(
        "flex items-center gap-3 rounded-md border border-border-strong bg-ferry-surface p-4",
        className
      )}
      {...rest}
    >
      {Icon ? (
        <Icon
          className={cn("size-[18px] shrink-0 text-foreground", iconClassName)}
          aria-hidden
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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
 * Pen empty / unavailable — centered body copy inside the history panel.
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
      <p className="text-lg font-medium text-balance text-foreground">{title}</p>
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
