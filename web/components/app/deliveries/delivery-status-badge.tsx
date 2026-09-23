import { normalizeDeliveryStatus } from "@/components/app/deliveries/deliveries-state";
import { cn } from "@/lib/utils";

/**
 * Pen Delivery/StatusBadge ePqtu — surface-2 pill, 1px border, gap 6, pad 4×10,
 * 6px marker + 12/500 label. Unknown stays muted — never reads as delivered.
 */
export function DeliveryStatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label: string;
  className?: string;
}) {
  const normalized = normalizeDeliveryStatus(status);

  const dotClass =
    normalized === "delivered"
      ? "bg-ferry-transfer"
      : normalized === "failed"
        ? "bg-destructive"
        : normalized === "sent"
          ? "bg-chart-2"
          : normalized === "queued"
            ? "bg-muted-foreground/70"
            : "bg-border";

  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-border bg-ferry-surface-2 px-2.5 py-1 text-xs font-medium text-foreground",
        className
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", dotClass)}
      />
      <span className="min-w-0 break-words">{label}</span>
    </span>
  );
}
