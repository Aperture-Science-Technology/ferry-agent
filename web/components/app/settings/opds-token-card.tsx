import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Pen Section/OPDS token row — meta + badge + Ghost revoke inside the OPDS card.
 * Lives in settings (no standalone OPDS Tokens route).
 */
export function OpdsTokenCard({
  tokenId,
  title,
  badge,
  meta,
  actions,
  qr,
  className,
}: {
  tokenId?: string;
  title: string;
  badge?: ReactNode;
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
        "flex min-w-0 items-center gap-4 border-b border-border py-4 last:border-b-0",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium break-words whitespace-normal text-foreground">
            {title}
          </h3>
          {badge}
        </div>
        <div className="text-xs font-medium break-words whitespace-normal text-muted-foreground">
          {meta}
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
      {qr}
    </article>
  );
}

/** Pen Badge/Actif | Révoqué — surface-2 pill, border-strong, 12/500. */
export function OpdsTokenStatusBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-border-strong bg-ferry-surface-2 px-2.5 py-1 text-xs font-medium text-foreground",
        className
      )}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full bg-ferry-transfer"
      />
      <span className="min-w-0 break-words">{label}</span>
    </span>
  );
}
