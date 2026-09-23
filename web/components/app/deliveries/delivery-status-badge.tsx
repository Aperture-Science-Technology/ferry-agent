import { Badge } from "@/components/ui/badge";
import { normalizeDeliveryStatus } from "@/components/app/deliveries/deliveries-state";
import { cn } from "@/lib/utils";
import type { DeliveryStatus } from "@/lib/types";

const STATUS_VARIANT: Record<
  DeliveryStatus | "unknown",
  "default" | "secondary" | "destructive" | "outline" | "ghost"
> = {
  queued: "secondary",
  sent: "outline",
  delivered: "default",
  failed: "destructive",
  unknown: "ghost",
};

/**
 * Status chip with an ink/copper marker.
 * delivered uses primary fill; queued/sent stay muted — never look like success.
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
  const variant = STATUS_VARIANT[normalized];

  const dotClass =
    normalized === "delivered"
      ? "bg-primary-foreground"
      : normalized === "failed"
        ? "bg-destructive"
        : normalized === "sent"
          ? "bg-chart-2"
          : normalized === "queued"
            ? "bg-muted-foreground/70"
            : "bg-border";

  return (
    <Badge
      variant={variant}
      className={cn(
        "max-w-full min-w-0 gap-1.5 overflow-hidden whitespace-normal",
        className
      )}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", dotClass)} />
      <span className="min-w-0 break-words">{label}</span>
    </Badge>
  );
}
