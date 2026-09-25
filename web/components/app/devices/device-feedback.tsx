"use client";

import {
  CircleAlert,
  LoaderCircle,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Pen Feedback/Loading|Error|Partial — ferry-surface, border-strong, radius-md,
 * pad 16. Loading: horizontal gap 12. Error/Partial: vertical gap 16 + Actions.
 */

const shellClass =
  "w-full rounded-md border border-border-strong bg-ferry-surface p-4";

function FeedbackText({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="text-xs font-medium text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </div>
  );
}

function FeedbackActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-3">{children}</div>
  );
}

export function DeviceFeedbackLoading({
  icon: Icon = LoaderCircle,
  iconClassName = "animate-spin motion-reduce:animate-none",
  title,
  description,
  role = "status",
  className,
  children,
  ...rest
}: {
  icon?: LucideIcon;
  iconClassName?: string;
  title: string;
  description?: string;
  role?: "status" | "alert";
  className?: string;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "title" | "children" | "role">) {
  return (
    <div
      role={role}
      data-feedback-state="loading"
      className={cn(shellClass, "flex items-center gap-3", className)}
      {...rest}
    >
      <Icon
        className={cn("size-[18px] shrink-0 text-foreground", iconClassName)}
        aria-hidden
      />
      <FeedbackText title={title} description={description}>
        {children}
      </FeedbackText>
    </div>
  );
}

export function DeviceFeedbackError({
  title,
  description,
  dismissLabel,
  onDismiss,
  retryLabel,
  onRetry,
  role = "alert",
  className,
  children,
  ...rest
}: {
  title: string;
  description?: string;
  dismissLabel?: string;
  onDismiss?: () => void;
  retryLabel?: string;
  onRetry?: () => void;
  role?: "status" | "alert";
  className?: string;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "title" | "children" | "role">) {
  const showActions = Boolean(
    (onDismiss && dismissLabel) || (onRetry && retryLabel)
  );
  return (
    <div
      role={role}
      data-feedback-state="error"
      className={cn(shellClass, "flex flex-col gap-4", className)}
      {...rest}
    >
      <div className="flex items-center gap-3">
        <TriangleAlert
          className="size-[18px] shrink-0 text-foreground"
          aria-hidden
        />
        <FeedbackText title={title} description={description}>
          {children}
        </FeedbackText>
      </div>
      {showActions ? (
        <FeedbackActions>
          {onDismiss && dismissLabel ? (
            <Button type="button" variant="ghost" onClick={onDismiss}>
              {dismissLabel}
            </Button>
          ) : null}
          {onRetry && retryLabel ? (
            <Button type="button" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
        </FeedbackActions>
      ) : null}
    </div>
  );
}

export function DeviceFeedbackPartial({
  title,
  description,
  ignoreLabel,
  onIgnore,
  refreshLabel,
  onRefresh,
  role = "status",
  className,
  children,
  ...rest
}: {
  title: string;
  description?: string;
  ignoreLabel?: string;
  onIgnore?: () => void;
  refreshLabel?: string;
  onRefresh?: () => void;
  role?: "status" | "alert";
  className?: string;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "title" | "children" | "role">) {
  const showActions = Boolean(
    (onIgnore && ignoreLabel) || (onRefresh && refreshLabel)
  );
  return (
    <div
      role={role}
      data-feedback-state="partial"
      className={cn(shellClass, "flex flex-col gap-4", className)}
      {...rest}
    >
      <div className="flex items-center gap-3">
        <CircleAlert
          className="size-[18px] shrink-0 text-foreground"
          aria-hidden
        />
        <FeedbackText title={title} description={description}>
          {children}
        </FeedbackText>
      </div>
      {showActions ? (
        <FeedbackActions>
          {onIgnore && ignoreLabel ? (
            <Button type="button" variant="ghost" onClick={onIgnore}>
              {ignoreLabel}
            </Button>
          ) : null}
          {onRefresh && refreshLabel ? (
            <Button type="button" onClick={onRefresh}>
              {refreshLabel}
            </Button>
          ) : null}
        </FeedbackActions>
      ) : null}
    </div>
  );
}

/**
 * Flexible shell for default-dest hints and legacy call sites.
 * Prefer DeviceFeedbackLoading|Error|Partial for specimen states.
 */
export function DeviceFeedback({
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
} & Omit<HTMLAttributes<HTMLDivElement>, "title" | "children" | "role">) {
  return (
    <div
      role={role}
      className={cn(shellClass, "flex items-center gap-3", className)}
      {...rest}
    >
      {Icon ? (
        <Icon
          className={cn("size-[18px] shrink-0 text-foreground", iconClassName)}
          aria-hidden
        />
      ) : null}
      <FeedbackText title={title} description={description}>
        {children}
      </FeedbackText>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Pen empty / unavailable — centered heading 18/500 + body 14/500.
 */
export function DeviceEmpty({
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
