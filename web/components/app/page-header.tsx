import type { ReactNode } from "react";

/** Pen Header/Page ePLzB title block — Fraunces 18/500 + optional 12/500 subtitle, min-height 72. */
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
    <div className="flex min-h-[72px] flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="font-heading text-lg font-medium text-foreground text-balance">
          {title}
        </h1>
        {description ? (
          <p className="text-xs font-medium text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}
