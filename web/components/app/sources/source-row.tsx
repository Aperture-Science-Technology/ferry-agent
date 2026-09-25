import type { ReactNode } from "react";
import { Folder, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type {
  KnownSourceType,
  SourceAvailability,
} from "@/components/app/sources/sources-state";

/** Pen SourceRow Sub — 12/500 muted. */
export function SourceMetaLine({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 text-xs font-medium break-words whitespace-normal text-muted-foreground">
      {children}
    </div>
  );
}

/**
 * Pen Toggle — 44×24, pill, pad 2, fill ferry-text when on, knob 20×20 ferry-bg.
 * Native button + role=switch (keyboard + aria-checked); not a decorative control.
 */
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
  const inert = disabled || pending;
  return (
    <div className="flex shrink-0 items-center gap-2">
      {pending ? (
        <Loader2
          className="size-4 shrink-0 animate-spin text-muted-foreground"
          aria-hidden
        />
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={inert}
        onClick={onToggle}
        className={cn(
          "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
          "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          checked ? "justify-end bg-foreground" : "justify-start bg-input",
          inert && "cursor-not-allowed opacity-50"
        )}
      >
        <span
          className="pointer-events-none size-5 rounded-full bg-background"
          aria-hidden
        />
      </button>
    </div>
  );
}

/** Pen Button/Ghost « Configurer » — navigates to a real app destination. */
export function SourceConfigureButton({
  href,
  label,
  ariaLabel,
}: {
  href: "/app/bibliotheque" | "/app/gateways";
  label: string;
  ariaLabel: string;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className="min-w-0 whitespace-normal"
      aria-label={ariaLabel}
      render={<Link href={href}>{label}</Link>}
    />
  );
}

/**
 * Pen Source/SourceRow — icon wrap 40×40 surface-2 + meta 16/500 + 12/500,
 * gap 16, pad 12 0, bottom border (not on last). Trailing = Configurer + Toggle.
 */
export function SourceRow({
  type,
  availability,
  title,
  meta,
  trailing,
  footer,
}: {
  type: KnownSourceType;
  availability: SourceAvailability;
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
      className="flex min-w-0 flex-col gap-2 border-b border-border-strong py-3 last:border-b-0"
    >
      <div className="flex min-w-0 items-center gap-4">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-ferry-surface-2"
          aria-hidden
        >
          <Folder className="size-[18px] text-foreground" />
        </div>
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
