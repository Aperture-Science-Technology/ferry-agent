"use client";

import { useState, type ReactNode } from "react";
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
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/app/empty-state";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { useApiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
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

function SoftNotice({
  title,
  description,
  role = "status",
}: {
  title: string;
  description: string;
  role?: "status" | "alert";
}) {
  return (
    <div
      role={role}
      className="flex flex-col gap-1 border border-border bg-muted/40 px-4 py-3"
    >
      <p className="font-heading text-sm font-medium tracking-tight break-words whitespace-normal">
        {title}
      </p>
      <p className="text-sm leading-relaxed break-words whitespace-normal text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

/** Pen Source/SourceRow Ny3Dd — icon 18 + title 16/500 + sub 12/500, pad 12 0, bottom border. */
function SourceRow({
  type,
  availability,
  title,
  meta,
  trailing,
  footer,
}: {
  type: KnownSourceType;
  availability: SourceAvailability;
  title: string;
  meta: ReactNode;
  trailing?: ReactNode;
  footer?: ReactNode;
}) {
  const Icon = PROVIDER_META[type].icon;
  return (
    <article
      data-testid="source-row"
      data-source-type={type}
      data-source-availability={availability}
      className="flex min-w-0 flex-col gap-2 border-b border-border py-3 last:border-b-0"
    >
      <div className="flex min-w-0 items-center gap-4">
        <Icon
          className="size-[18px] shrink-0 text-foreground"
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="min-w-0 text-base font-medium break-words whitespace-normal text-foreground">
            {title}
          </h2>
          <div className="min-w-0 text-xs font-medium break-words whitespace-normal text-muted-foreground">
            {meta}
          </div>
        </div>
        {trailing ? (
          <div className="flex shrink-0 items-center gap-2">{trailing}</div>
        ) : null}
      </div>
      {footer}
    </article>
  );
}

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
        <>
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
        </>
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
          title={name}
          meta={rowMeta(type, availability)}
          trailing={trailing}
          footer={footer}
        />
      </RevealItem>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-6",
        "pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      )}
      data-testid="sources-pen-layout"
      data-sources-state={surfaceState}
    >
      {/* Pen Header/PageTitle Hd0003 (28/14) + mobile Top mF0050 (brand/22/12) */}
      <header className="flex min-h-[72px] flex-col justify-center gap-2">
        <p className="font-heading text-sm font-medium text-muted-foreground md:hidden">
          {tBrand("name")}
        </p>
        <h1 className="font-heading text-[22px] font-medium text-foreground md:text-[28px]">
          {title}
        </h1>
        <p className="text-xs font-medium text-muted-foreground md:text-sm">
          <span className="md:hidden">{descriptionMobile}</span>
          <span className="hidden md:inline">{description}</span>
        </p>
      </header>

      <p className="max-w-3xl text-sm font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
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
        <SoftNotice title={t("partialTitle")} description={t("partialNote")} />
      ) : null}

      {updateError ? (
        <SoftNotice
          title={t("updateErrorTitle")}
          description={updateError}
          role="alert"
        />
      ) : null}

      <Reveal>
        <div data-testid="sources-rows">
          <RevealGroup className="flex min-w-0 flex-col">
            {SOURCE_DISPLAY_TYPES.map((type) => renderRow(type))}
          </RevealGroup>
        </div>
      </Reveal>
    </div>
  );
}
