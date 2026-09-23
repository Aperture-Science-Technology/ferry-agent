import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Pen OPDS card (EYJrN L00022 / mF005b L00064) —
 * surface + border r md, title 14/500, meta 12/500, pad 12 mobile / 16 desktop, gap 10.
 */
export function OpdsTokenCard({
  tokenId,
  title,
  meta,
  actions,
  qr,
  className,
}: {
  tokenId?: string;
  title: string;
  meta: ReactNode;
  actions?: ReactNode;
  qr?: ReactNode;
  className?: string;
}) {
  return (
    <article
      data-testid="opds-token-card"
      data-token-id={tokenId}
      className={cn(
        "flex min-w-0 flex-col gap-2.5 rounded-md border border-border bg-card p-3 md:p-4",
        className
      )}
    >
      <h3 className="text-sm font-medium break-words whitespace-normal text-foreground">
        {title}
      </h3>
      <div className="text-xs font-medium break-words whitespace-normal text-muted-foreground">
        {meta}
      </div>
      {actions ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
      {qr}
    </article>
  );
}
