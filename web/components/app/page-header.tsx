import type { ReactNode } from "react";

/**
 * Header/Page — h 88, pad 8, space-between; title 28/700 tracking -0.5;
 * subtitle muted 14/500, no max-width.
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
        <h1 className="text-[28px] font-bold tracking-[-0.5px] text-foreground text-balance">
          {title}
        </h1>
        {description ? (
          <p className="text-sm font-medium text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        // min-w-0 max-w-full (not shrink-0): action cluster may wrap under the
        // title on narrow viewports instead of forcing document scrollWidth.
        <div
          data-testid="page-header-actions"
          className="flex min-w-0 max-w-full flex-wrap items-center gap-3"
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}
