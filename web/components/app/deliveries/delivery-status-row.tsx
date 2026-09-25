import type { ReactNode } from "react";
import { Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeliveryStatusBadge } from "@/components/app/deliveries/delivery-status-badge";
import type { DeliveryJob } from "@/lib/types";

export function DeliveryActions({
  job,
  onTrack,
  trackLabel,
  downloadLabel,
  trackAria,
}: {
  job: DeliveryJob;
  onTrack: () => void;
  trackLabel: string;
  downloadLabel: string;
  trackAria: string;
  /** @deprecated Pen row action is always Ghost — kept for call-site compatibility. */
  emphasizeTrack?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {job.download_url ? (
        <Button
          size="sm"
          variant="ghost"
          className="min-w-0 whitespace-normal"
          render={
            <a href={job.download_url} target="_blank" rel="noreferrer">
              <Download />
              {downloadLabel}
            </a>
          }
        />
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        className="min-w-0 whitespace-normal"
        aria-label={trackAria || undefined}
        onClick={onTrack}
      >
        <Eye />
        {trackLabel}
      </Button>
    </div>
  );
}

/**
 * Pen Delivery/StatusRow — full width, bottom border, gap 16, pad 12 0,
 * Meta (title + relative when) · Badge · Actions.
 */
export function DeliveryStatusRow({
  job,
  routeTitle,
  statusLabel,
  dateLabel,
  hints,
  actions,
}: {
  job: DeliveryJob;
  routeTitle: string;
  statusLabel: string;
  dateLabel: string;
  /** @deprecated Kept for callers; method no longer shown on the row. */
  methodLabel?: string;
  hints?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article
      data-testid="delivery-status-row"
      aria-label={`${routeTitle}, ${statusLabel}`}
      className="flex w-full min-w-0 items-center gap-4 border-b border-border-strong py-3 last:border-b-0"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="text-base font-medium break-words whitespace-normal text-foreground">
          {routeTitle}
        </h2>
        <p className="text-xs font-medium break-words whitespace-normal text-muted-foreground">
          {dateLabel}
        </p>
        {hints}
      </div>
      <DeliveryStatusBadge
        status={job.status}
        label={statusLabel}
        className="shrink-0"
      />
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </article>
  );
}
