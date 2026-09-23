import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { KnownSourceType, SourceAvailability } from "@/components/app/sources/sources-state";

/** Pen SourceRow Sub — 12/500 muted; · separators on desktop group · status. */
export function SourceMetaLine({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 text-xs font-medium break-words whitespace-normal text-muted-foreground">
      {children}
    </div>
  );
}

/** Toggle trailing — business action (not in Pen mock Ny3Dd; required for Gutenberg / Standard Ebooks). */
export function SourceToggle({
  checked,
  pending,
  disabled,
  ariaLabel,
  onToggle,
}: {
  checked: boolean;
  pending: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onToggle: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {pending ? (
        <Loader2
          className="size-4 shrink-0 animate-spin text-muted-foreground"
          aria-hidden
        />
      ) : null}
      <Switch
        checked={checked}
        disabled={disabled || pending}
        onCheckedChange={onToggle}
        aria-label={ariaLabel}
      />
    </div>
  );
}

/**
 * Pen Source/SourceRow Ny3Dd — icon 18 + title 16/500 + sub 12/500,
 * gap 16, pad 12 0, bottom border. Trailing = status/actions (Switch or links).
 */
export function SourceRow({
  type,
  availability,
  icon: Icon,
  title,
  meta,
  trailing,
  footer,
}: {
  type: KnownSourceType;
  availability: SourceAvailability;
  icon: LucideIcon;
  title: string;
  meta: ReactNode;
  trailing?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <article
      data-testid="source-row"
      data-source-type={type}
      data-source-availability={availability}
      className="flex min-w-0 flex-col gap-2 border-b border-border py-3 last:border-b-0"
    >
      <div className="flex min-w-0 items-center gap-4">
        <Icon
          className="size-[18px] shrink-0 text-foreground"
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="min-w-0 text-base font-medium break-words whitespace-normal text-foreground">
            {title}
          </h2>
          <SourceMetaLine>{meta}</SourceMetaLine>
        </div>
        {trailing ? (
          <div className="flex shrink-0 items-center gap-2">{trailing}</div>
        ) : null}
      </div>
      {footer}
    </article>
  );
}
