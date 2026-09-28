import type { ReactNode } from "react";

/**
 * Pen 06 Main / Header — gap 8, title 40/900 (32/900 mobile), subtitle 16/500
 * max 560. Auto height so the 40px title can breathe (no fixed h-[88px]).
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
    <div className="flex flex-wrap items-center justify-between gap-4 p-2">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h1 className="text-[32px] font-black text-foreground text-balance md:text-[40px]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-[560px] text-base font-medium text-muted-foreground">
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
