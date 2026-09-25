import type { ReactNode } from "react";
import { Link2, Pencil, Tablet, Trash2 } from "lucide-react";
import { BrandBadge } from "@/components/app/devices/brand-badge";
import { cloudLinkPresentation } from "@/components/app/devices/devices-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Device } from "@/lib/types";

/** Brand + optional model — identity under custom name, or title when name absent. */
export function DeviceIdentity({
  device,
  muted = true,
}: {
  device: Device;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 font-medium",
        muted
          ? "text-xs text-muted-foreground"
          : "text-base text-foreground"
      )}
    >
      <BrandBadge brand={device.brand} className="min-w-0 max-w-full" />
      {device.model ? (
        <span className="min-w-0 max-w-full break-words whitespace-normal">
          — {device.model}
        </span>
      ) : null}
    </span>
  );
}

/** Pen DeviceRow Sub — profile · method · sync (12/500 muted, · separators). */
export function DeviceMetaLine({ parts }: { parts: string[] }) {
  const visible = parts.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <span className="inline text-xs font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
      {visible.map((part, index) => (
        <span key={`${part}-${index}`}>
          {index > 0 ? (
            <span className="mx-1.5 text-border" aria-hidden>
              ·
            </span>
          ) : null}
          <span>{part}</span>
        </span>
      ))}
    </span>
  );
}

/** Pen DeviceRow State — cloud linked / not-linked (API); OAuth error handled at page level. */
export function DeviceCloudState({
  device,
  linkedDropbox,
  linkedDrive,
  linked,
  notLinked,
}: {
  device: Device;
  linkedDropbox: string;
  linkedDrive: string;
  linked: string;
  notLinked: string;
}) {
  const presentation = cloudLinkPresentation(device);
  if (presentation !== "linked") {
    return (
      <span className="shrink-0 text-xs font-medium break-words whitespace-normal text-muted-foreground">
        {notLinked}
      </span>
    );
  }
  const label =
    device.cloud_provider === "dropbox"
      ? linkedDropbox
      : device.cloud_provider === "drive"
        ? linkedDrive
        : linked;
  return (
    <span className="shrink-0 text-xs font-medium break-words whitespace-normal text-muted-foreground">
      {label}
    </span>
  );
}

export function DeviceActions({
  device,
  onEdit,
  onLink,
  onDelete,
  editLabel,
  linkLabel,
  deleteLabel,
  editAria,
  disabled,
}: {
  device: Device;
  onEdit: () => void;
  onLink: () => void;
  onDelete: () => void;
  editLabel: string;
  linkLabel: string;
  deleteLabel: string;
  editAria?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        className="min-w-0 whitespace-normal"
        onClick={onEdit}
        disabled={disabled}
        aria-label={editAria || undefined}
      >
        <Pencil />
        {editLabel}
      </Button>
      {device.delivery_tier === "B" ? (
        <Button
          size="sm"
          variant="ghost"
          className="min-w-0 whitespace-normal"
          onClick={onLink}
          disabled={disabled}
        >
          <Link2 />
          {linkLabel}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        className="min-w-0 whitespace-normal"
        onClick={onDelete}
        disabled={disabled}
      >
        <Trash2 />
        {deleteLabel}
      </Button>
    </div>
  );
}

/**
 * Pen Device/DeviceRow yTrhR — icon wrap 40×40 + meta (16/500 + 12/500) + actions,
 * gap 16, pad 12 0, bottom border.
 */
export function DeviceRow({
  device,
  title,
  identity,
  meta,
  cloud,
  actions,
  ariaLabel,
}: {
  device: Device;
  title: ReactNode;
  identity: ReactNode;
  meta: ReactNode;
  cloud: ReactNode;
  actions: ReactNode;
  ariaLabel?: string;
}) {
  const hasSubtitle = Boolean(identity || meta || cloud);

  return (
    <article
      data-testid="device-row"
      data-device-id={device.id}
      aria-label={ariaLabel}
      className="flex w-full min-w-0 flex-wrap items-center gap-4 border-b border-border-strong py-3 last:border-b-0"
    >
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-ferry-surface"
        aria-hidden
      >
        <Tablet className="size-[18px] text-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="min-w-0 text-base font-medium break-words whitespace-normal text-foreground">
          {title}
        </h2>
        {hasSubtitle ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {identity}
            {identity && meta ? (
              <span className="text-border" aria-hidden>
                ·
              </span>
            ) : null}
            {meta}
            {(identity || meta) && cloud ? (
              <span className="text-border" aria-hidden>
                ·
              </span>
            ) : null}
            {cloud}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div
          data-testid="device-row-actions"
          className="flex min-w-0 max-w-full flex-wrap items-center gap-2"
        >
          {actions}
        </div>
      ) : null}
    </article>
  );
}
