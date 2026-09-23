import type { ReactNode } from "react";
import { Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeliveryStatusBadge } from "@/components/app/deliveries/delivery-status-badge";
import type { DeliveryJob } from "@/lib/types";

/** Pen StatusRow When line — method · format · date (12/500 muted). */
export function DeliveryWhenLine({
  method,
  format,
  date,
}: {
  method: string;
  format: string | null;
  date: string;
}) {
  return (
    <p className="text-xs font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
      <span>{method}</span>
      {format ? (
        <>
          <span className="mx-1.5 text-border" aria-hidden>
            ·
          </span>
          <span className="uppercase tracking-wide">{format}</span>
        </>
      ) : null}
      <span className="mx-1.5 text-border" aria-hidden>
        ·
      </span>
      <span>{date}</span>
    </p>
  );
}

export function DeliveryActions({
  job,
  onTrack,
  trackLabel,
  downloadLabel,
  trackAria,
  emphasizeTrack = false,
}: {
  job: DeliveryJob;
  onTrack: () => void;
  trackLabel: string;
  downloadLabel: string;
  trackAria: string;
  emphasizeTrack?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {job.download_url ? (
        <Button
          size="sm"
          variant="outline"
          className="min-w-0 whitespace-normal rounded-md"
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
        variant={emphasizeTrack ? "default" : "outline"}
        className="min-w-0 whitespace-normal rounded-md"
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
 * Pen Delivery/StatusRow mtEug — paper row: meta + badge (gap 16), pad 12 0,
 * bottom border. Actions sit below for track/download (business, not in Pen mock).
 */
export function DeliveryStatusRow({
  job,
  routeTitle,
  methodLabel,
  statusLabel,
  dateLabel,
  hints,
  actions,
}: {
  job: DeliveryJob;
  routeTitle: string;
  methodLabel: string;
  statusLabel: string;
  dateLabel: string;
  hints?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article
      data-testid="delivery-status-row"
      className="flex min-w-0 flex-col gap-3 border-b border-border py-3 last:border-b-0"
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-base font-medium break-words whitespace-normal text-foreground">
            {routeTitle}
          </h2>
          <DeliveryWhenLine
            method={methodLabel}
            format={job.target_format ?? null}
            date={dateLabel}
          />
          {hints}
        </div>
        <DeliveryStatusBadge
          status={job.status}
          label={statusLabel}
          className="shrink-0"
        />
      </div>
      {actions}
    </article>
  );
}
