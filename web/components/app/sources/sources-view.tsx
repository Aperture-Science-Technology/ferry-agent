"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  CircleAlert,
  Feather,
  Library,
  Share2,
  TriangleAlert,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  SourcesEmpty,
  SourcesFeedback,
} from "@/components/app/sources/source-feedback";
import {
  SourceRow,
  SourceToggle,
} from "@/components/app/sources/source-row";
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

export function SourcesView({
  title,
  description,
  descriptionMobile,
  initialSources,
  sourcesUnavailable,
}: {
  title: string;
  description: string;
  descriptionMobile: string;
  initialSources: Source[];
  sourcesUnavailable: boolean;
}) {
  const t = useTranslations("sources");
  const tBrand = useTranslations("brand");
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

  function rowMeta(
    type: KnownSourceType,
    availability: SourceAvailability
  ): ReactNode {
    if (type === "upload") {
      return (
        <>
          <span className="md:hidden">{t("alwaysActive")}</span>
          <span className="hidden md:inline">
            {t("alwaysActive")}
            {" · "}
            <Link
              href="/app/bibliotheque"
              className="underline-offset-2 hover:underline"
            >
              {t("uploadShelf")}
            </Link>
          </span>
        </>
      );
    }
    if (type === "torrent_gateway") {
      return (
        <>
          <Link
            href="/app/gateways"
            className="md:hidden underline-offset-2 hover:underline"
          >
            {t("gatewayLocalShort")}
          </Link>
          <Link
            href="/app/gateways"
            className="hidden md:inline underline-offset-2 hover:underline"
          >
            {t("gatewayLocal")}
          </Link>
        </>
      );
    }
    const group =
      sourceGroup(type) === "openAccess"
        ? t("groupOpenAccess")
        : t("groupLocal");
    const label = availabilityLabel(availability);
    return (
      <>
        <span className="md:hidden">{label}</span>
        <span className="hidden md:inline">
          {group} · {label}
        </span>
      </>
    );
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
    const source = findSourceByType(sources, type);
    const availability = sourceAvailability(type, sources, sourcesUnavailable);
    const pending = source ? pendingIds.has(source.id) : false;
    const toggleable = canToggleSource(type, sources, sourcesUnavailable);
    const enabled = availability === "enabled";
    const name = t(`providers.${meta.key}.name`);

    const trailing =
      toggleable && source ? (
        <SourceToggle
          checked={enabled}
          pending={pending}
          onToggle={() => void toggle(source)}
          ariaLabel={
            enabled
              ? t("disableAria", { name })
              : t("enableAria", { name })
          }
        />
      ) : undefined;

    const footer =
      availability === "unknown" ? (
        <p className="pl-[34px] text-xs font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
          {t("unknownHint")}
        </p>
      ) : null;

    return (
      <RevealItem key={type}>
        <SourceRow
          type={type}
          availability={availability}
          icon={meta.icon}
          title={name}
          meta={rowMeta(type, availability)}
          trailing={trailing}
          footer={footer}
        />
      </RevealItem>
    );
  }

  const rows = (
    <Reveal>
      <div data-testid="sources-rows">
        <RevealGroup className="flex min-w-0 flex-col gap-3 md:gap-0">
          {SOURCE_DISPLAY_TYPES.map((type) => renderRow(type))}
        </RevealGroup>
      </div>
    </Reveal>
  );

  return (
    <div
      className="flex min-w-0 flex-col gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:gap-6"
      data-testid="sources-pen-layout"
      data-sources-state={surfaceState}
    >
      {/* Title stacks are dedicated (mF0050 Top vs Hd0003); no shared DashboardHeader. */}
      <div className="flex flex-col gap-2 md:min-h-[72px]">
        <header
          data-testid="sources-header-mobile"
          className="flex flex-col gap-2 md:hidden"
        >
          <p className="font-heading text-sm font-medium text-muted-foreground">
            {tBrand("name")}
          </p>
          <h1 className="font-heading text-[22px] font-medium text-foreground">
            {title}
          </h1>
          <p className="text-xs font-medium text-muted-foreground">
            {descriptionMobile}
          </p>
        </header>

        <header
          data-testid="sources-header-desktop"
          className="hidden min-w-0 flex-1 flex-col gap-2 md:flex"
        >
          <h1 className="font-heading text-[28px] font-medium text-foreground">
            {title}
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            {description}
          </p>
        </header>
      </div>

      {/* Pen Hint oXf2k — desktop only (absent from mF0050 Body). */}
      <p className="hidden max-w-3xl text-sm font-medium leading-relaxed break-words whitespace-normal text-muted-foreground md:block">
        {t("supportedHint")}
      </p>

      {sourcesUnavailable ? (
        <SourcesEmpty
          role="alert"
          icon={Library}
          title={t("unavailableTitle")}
          description={t("unavailableNote")}
        />
      ) : null}

      {!sourcesUnavailable && sources.length === 0 ? (
        <SourcesEmpty
          icon={Library}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : null}

      {partial ? (
        <SourcesFeedback
          icon={CircleAlert}
          title={t("partialTitle")}
          description={t("partialNote")}
        />
      ) : null}

      {updateError ? (
        <SourcesFeedback
          role="alert"
          icon={TriangleAlert}
          title={t("updateErrorTitle")}
          description={updateError}
        />
      ) : null}

      {/* Pen Body — mobile gap 12 (mF0050); desktop Rows stack (EYiIt). */}
      <div data-testid="sources-body">{rows}</div>
    </div>
  );
}
