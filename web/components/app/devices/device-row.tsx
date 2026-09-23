import type { ReactNode } from "react";
import { Link2, Pencil, Trash2 } from "lucide-react";
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
        "inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-medium",
        muted ? "text-muted-foreground" : "text-foreground"
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
    <p className="text-xs font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
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
    </p>
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
      <span className="shrink-0 text-sm font-medium break-words whitespace-normal text-muted-foreground">
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
    <span className="max-w-[40%] shrink-0 text-sm font-medium break-words whitespace-normal text-muted-foreground">
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
  disabled,
}: {
  device: Device;
  onEdit: () => void;
  onLink: () => void;
  onDelete: () => void;
  editLabel: string;
  linkLabel: string;
  deleteLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="min-w-0 whitespace-normal rounded-md"
        onClick={onEdit}
        disabled={disabled}
      >
        <Pencil />
        {editLabel}
      </Button>
      {device.delivery_tier === "B" ? (
        <Button
          size="sm"
          variant="outline"
          className="min-w-0 whitespace-normal rounded-md"
          onClick={onLink}
          disabled={disabled}
        >
          <Link2 />
          {linkLabel}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="destructive"
        className="min-w-0 whitespace-normal rounded-md"
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
 * Pen Device/DeviceRow yTrhR — mark 40×40 surface r-sm + meta + state, gap 16,
 * pad 12 0, bottom border. Actions sit below (business, not in Pen mock).
 */
export function DeviceRow({
  device,
  title,
  identity,
  meta,
  cloud,
  actions,
}: {
  device: Device;
  title: ReactNode;
  identity: ReactNode;
  meta: ReactNode;
  cloud: ReactNode;
  actions: ReactNode;
}) {
  return (
    <article
      data-testid="device-row"
      data-device-id={device.id}
      className="flex min-w-0 flex-col gap-3 border-b border-border py-3 last:border-b-0"
    >
      <div className="flex min-w-0 items-center gap-4">
        <BrandBadge
          brand={device.brand}
          showLabel={false}
          size="lg"
          className="shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="min-w-0 text-base font-medium break-words whitespace-normal text-foreground">
            {title}
          </h2>
          {identity}
          {meta}
        </div>
        {cloud}
      </div>
      {actions}
    </article>
  );
}
