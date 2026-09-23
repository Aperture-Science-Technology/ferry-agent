"use client";

import { useTranslations } from "next-intl";
import {
  gatewayConnectionPresentation,
  type GatewayConnectionPresentation,
} from "@/components/app/gateways/gateways-state";
import { cn } from "@/lib/utils";
import type { Gateway } from "@/lib/types";

type AccessTranslations = ReturnType<typeof useTranslations<"access">>;

/** Copper / ferry-transfer status — never emerald “synced” teal. */
export function ConnectionDot({
  presentation,
}: {
  presentation: GatewayConnectionPresentation;
}) {
  return (
    <span
      aria-hidden
      data-connection-dot={presentation}
      className={cn(
        "size-2 shrink-0 rounded-full",
        presentation === "connected" && "bg-ferry-transfer",
        presentation === "pending" && "bg-ferry-transfer/45",
        presentation === "expired" && "bg-destructive",
        presentation === "offline" && "bg-muted-foreground/45",
        presentation === "revoked" && "bg-muted-foreground/35",
        presentation === "unknown" && "bg-muted-foreground/40"
      )}
    />
  );
}

export function summarizeConnection(
  gateways: Gateway[],
  now: number
): GatewayConnectionPresentation | null {
  if (gateways.length === 0) return null;
  const presentations = gateways.map((g) =>
    gatewayConnectionPresentation(g, now)
  );
  const order: GatewayConnectionPresentation[] = [
    "connected",
    "pending",
    "expired",
    "offline",
    "revoked",
    "unknown",
  ];
  return order.find((p) => presentations.includes(p)) ?? "unknown";
}

export function summaryLabel(
  presentation: GatewayConnectionPresentation,
  t: AccessTranslations
): string {
  switch (presentation) {
    case "pending":
      return t("statusPending");
    case "expired":
      return t("statusExpired");
    case "connected":
      return t("statusConnected");
    case "revoked":
      return t("statusRevoked");
    case "offline":
      return t("statusOffline");
    default:
      return t("statusUnknown");
  }
}

/**
 * Pen Gateway/ConnectionState gsDDr — paper surface 420, pad 20, gap 12, r lg.
 * Screen gEtgk Connection / mobile mF0047 Conn.
 */
export function GatewayConnectionState({
  gateways,
  now,
}: {
  gateways: Gateway[];
  now: number;
}) {
  const t = useTranslations("access");
  const summary = summarizeConnection(gateways, now);

  return (
    <section
      data-gateway-connection-panel
      className="flex w-full max-w-[420px] flex-col gap-3 rounded-xl border border-border bg-card p-5"
    >
      <h2 className="font-heading text-lg font-medium tracking-tight break-words whitespace-normal text-foreground">
        {t("cloudLocalTitle")}
      </h2>
      <p className="text-sm font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
        {t("cloudLocalBody")}
      </p>
      {summary ? (
        <div
          className="flex min-w-0 items-center gap-2"
          data-connection-summary={summary}
        >
          <ConnectionDot presentation={summary} />
          <span className="text-sm font-medium break-words whitespace-normal text-foreground">
            {summaryLabel(summary, t)}
          </span>
        </div>
      ) : null}
    </section>
  );
}
