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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/app/empty-state";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { useApiClient } from "@/lib/api-client";
import type { Source } from "@/lib/types";
import {
  applySourceToggleFailure,
  applySourceToggleSuccess,
  canToggleSource,
  findSourceByType,
  hasPartialSources,
  SOURCE_DISPLAY_TYPES,
  sourceAvailability,
  sourceGroup,
  sourcesSurfaceState,
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

  const surfaceState = sourcesSurfaceState({
    sources,
    sourcesUnavailable,
    updateError,
  });
  const partial = hasPartialSources(sources, sourcesUnavailable);

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

  function metaLine(type: KnownSourceType, availability: SourceAvailability): string {
    if (type === "upload") {
      return `${t("alwaysActive")} · ${t("uploadShelf")}`;
    }
    if (type === "torrent_gateway") {
      return t("gatewayLocal");
    }
    const group =
      sourceGroup(type) === "openAccess"
        ? t("groupOpenAccess")
        : t("groupLocal");
    return `${group} · ${availabilityLabel(availability)}`;
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
    const name = t(`providers.${meta.key}.name`);

    return (
      <RevealItem key={type}>
        <article
          data-source-type={type}
          data-source-availability={availability}
          className="flex min-w-0 flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <div className="flex min-w-0 items-start gap-3">
            <Icon
              className="mt-0.5 size-[18px] shrink-0 text-foreground"
              aria-hidden
            />
            <div className="min-w-0 space-y-1">
              <h3 className="font-heading text-[15px] leading-snug font-medium tracking-tight break-words whitespace-normal sm:text-base">
                {name}
              </h3>
              <p className="text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
                {metaLine(type, availability)}
              </p>
              <p className="text-sm leading-relaxed break-words whitespace-normal text-muted-foreground">
                {t(`providers.${meta.key}.description`)}
              </p>
              {type === "upload" ? (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto max-w-full px-0 text-sm whitespace-normal"
                  render={<Link href="/app/bibliotheque">{t("uploadCta")}</Link>}
                />
              ) : null}
              {type === "torrent_gateway" ? (
                <div className="min-w-0 space-y-1">
                  <p className="text-sm leading-relaxed break-words whitespace-normal text-muted-foreground">
                    {t("gatewayHint")}
                  </p>
                  <p className="text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
                    {t("prowlarrNote")}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto max-w-full px-0 text-sm whitespace-normal"
                    render={<Link href="/app/gateways">{t("gatewayCta")}</Link>}
                  />
                </div>
              ) : null}
              {availability === "unknown" ? (
                <p className="text-xs leading-relaxed break-words whitespace-normal text-muted-foreground">
                  {t("unknownHint")}
                </p>
              ) : null}
            </div>
          </div>

          {toggleable && source ? (
            <div className="flex shrink-0 items-center justify-end gap-2 self-end sm:self-center sm:pl-2">
              {pending ? (
                <Loader2
                  className="size-4 shrink-0 animate-spin text-muted-foreground"
                  aria-hidden
                />
              ) : null}
              <Switch
                checked={enabled}
                disabled={pending}
                onCheckedChange={() => void toggle(source)}
                aria-label={
                  enabled
                    ? t("disableAria", { name })
                    : t("enableAria", { name })
                }
              />
            </div>
          ) : null}
        </article>
      </RevealItem>
    );
  }

  return (
    <div className="min-w-0 space-y-6" data-sources-state={surfaceState}>
      <p className="max-w-3xl text-sm leading-relaxed break-words whitespace-normal text-muted-foreground">
        {t("supportedHint")}
      </p>

      {sourcesUnavailable ? (
        <div role="alert">
          <EmptyState
            icon={Library}
            title={t("unavailableTitle")}
            description={t("unavailableNote")}
          />
        </div>
      ) : null}

      {!sourcesUnavailable && sources.length === 0 ? (
        <EmptyState
          icon={Library}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : null}

      {partial ? (
        <Alert>
          <Library aria-hidden />
          <AlertTitle>{t("partialTitle")}</AlertTitle>
          <AlertDescription>{t("partialNote")}</AlertDescription>
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
        <RevealGroup className="grid min-w-0 gap-0 divide-y divide-border/70 border-y border-border/70">
          {SOURCE_DISPLAY_TYPES.map((type) => renderRow(type))}
        </RevealGroup>
      </Reveal>
    </div>
  );
}
