import { cn } from "@/lib/utils";

/**
 * Pen Delivery/StatusBadge — surface-2 pill, 1px border, gap 6, pad 4×10,
 * 6px ferry-transfer marker + 12/500 label.
 */
export function DeliveryStatusBadge({
  label,
  className,
}: {
  /** Kept for callers that still pass status; badge geometry is status-agnostic. */
  status?: string;
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
