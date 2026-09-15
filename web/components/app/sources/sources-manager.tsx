"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  Feather,
  Library,
  Loader2,
  Share2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SectionHeader } from "@/components/app/section-header";
import { Reveal } from "@/components/motion/reveal";
import { useApiClient } from "@/lib/api-client";
import type { Source } from "@/lib/types";
import {
  applySourceToggleFailure,
  applySourceToggleSuccess,
  canToggleSource,
  findSourceByType,
  LOCAL_TYPES,
  OPEN_ACCESS_TYPES,
  sourceAvailability,
  type KnownSourceType,
  type SourceAvailability,
} from "@/components/app/sources/sources-state";

const PROVIDER_META: Record<
  KnownSourceType,
  { key: string; icon: LucideIcon }
> = {
  gutenberg: { key: "gutenberg", icon: BookOpen },
  standard_ebooks: { key: "standardEbooks", icon: Feather },
  upload: { key: "upload", icon: Upload },
  torrent_gateway: { key: "torrentGateway", icon: Share2 },
};

function availabilityBadgeVariant(
  availability: SourceAvailability
): "default" | "secondary" | "outline" {
  if (availability === "enabled" || availability === "always_on") {
    return "default";
  }
  if (availability === "unknown") return "outline";
  return "secondary";
}

export function SourcesManager({
  initialSources,
  sourcesUnavailable,
}: {
  initialSources: Source[];
  sourcesUnavailable: boolean;
}) {
  const t = useTranslations("sources");
  const { call } = useApiClient();
  const [sources, setSources] = useState(initialSources);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [updateError, setUpdateError] = useState<string | null>(null);

  function availabilityLabel(availability: SourceAvailability): string {
    switch (availability) {
      case "enabled":
        return t("enabled");
      case "disabled":
        return t("disabled");
      case "unknown":
        return t("unknown");
      case "always_on":
        return t("alwaysActive");
      case "gateway":
        return t("gatewayLocal");
      default:
        return t("unknown");
    }
  }

  async function toggle(source: Source) {
    setPendingIds((prev) => new Set(prev).add(source.id));
    setUpdateError(null);
    try {
      const updated = await call<Source>(`/api/v1/sources/${source.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !source.enabled }),
      });
      setSources((prev) => applySourceToggleSuccess(prev, updated));
      toast.success(updated.enabled ? t("toastEnabled") : t("toastDisabled"));
    } catch {
      setSources((prev) => applySourceToggleFailure(prev));
      setUpdateError(t("toastUpdateFailed"));
      toast.error(t("toastUpdateFailed"));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(source.id);
        return next;
      });
    }
  }

  function renderRow(type: KnownSourceType) {
    const meta = PROVIDER_META[type];
    const Icon = meta.icon;
    const source = findSourceByType(sources, type);
    const availability = sourceAvailability(type, sources, sourcesUnavailable);
    const pending = source ? pendingIds.has(source.id) : false;
    const toggleable = canToggleSource(type, sources, sourcesUnavailable);
    const enabled = availability === "enabled";

    return (
      <div
        key={type}
        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        <div className="flex min-w-0 items-start gap-3">
          <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="font-medium break-words">
              {t(`providers.${meta.key}.name`)}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(`providers.${meta.key}.description`)}
            </p>
            {type === "upload" ? (
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0 text-sm"
                render={<Link href="/app/bibliotheque">{t("uploadCta")}</Link>}
              />
            ) : null}
            {type === "torrent_gateway" ? (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {t("gatewayHint")}
                </p>
                <p className="text-xs text-muted-foreground">{t("prowlarrNote")}</p>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto px-0 text-sm"
                  render={<Link href="/app/gateways">{t("gatewayCta")}</Link>}
                />
              </div>
            ) : null}
            {availability === "unknown" ? (
              <p className="text-xs text-muted-foreground">{t("unknownHint")}</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 sm:pl-2">
          <Badge
            variant={availabilityBadgeVariant(availability)}
            className="max-w-full"
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            <span className="truncate">{availabilityLabel(availability)}</span>
          </Badge>
          {toggleable && source ? (
            <Switch
              checked={enabled}
              disabled={pending}
              onCheckedChange={() => void toggle(source)}
              aria-label={
                enabled
                  ? t("disableAria", { name: t(`providers.${meta.key}.name`) })
                  : t("enableAria", { name: t(`providers.${meta.key}.name`) })
              }
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {sourcesUnavailable ? (
        <Alert>
          <Library aria-hidden />
          <AlertTitle>{t("unavailableTitle")}</AlertTitle>
          <AlertDescription>{t("unavailableNote")}</AlertDescription>
        </Alert>
      ) : null}

      {updateError ? (
        <Alert variant="destructive" role="alert">
          <Library aria-hidden />
          <AlertTitle>{t("updateErrorTitle")}</AlertTitle>
          <AlertDescription>{updateError}</AlertDescription>
        </Alert>
      ) : null}

      <Reveal>
        <SectionHeader
          title={t("openAccessTitle")}
          description={t("openAccessDescription")}
        />
        <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card/60">
          {OPEN_ACCESS_TYPES.map((type) => renderRow(type))}
        </div>
      </Reveal>

      <Reveal>
        <SectionHeader
          title={t("localTitle")}
          description={t("localDescription")}
        />
        <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card/60">
          {LOCAL_TYPES.map((type) => renderRow(type))}
        </div>
      </Reveal>
    </div>
  );
}
