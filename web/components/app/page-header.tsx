import type { ReactNode } from "react";

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
    <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        <div className="mb-3 h-px w-20 bg-gradient-to-r from-chart-1 via-chart-2 to-transparent" />
        <h1 className="font-heading text-3xl font-medium tracking-tight text-balance">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
