import type { ReactNode } from "react";

/**
 * Pen Header/Page — h 88, pad 8, gap 16, space-between.
 * Title specimen 28/700 (absent from type scale — specimen wins for screen).
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-[88px] min-h-[88px] flex-wrap items-center justify-between gap-4 p-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="text-[28px] font-bold text-foreground text-balance">
          {title}
        </h1>
        {description ? (
          <p className="text-sm font-medium text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{action}</div>
      ) : null}
    </div>
  );
}
