"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Cable, Library } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  SourcesEmpty,
  SourcesFeedback,
  SourcesFeedbackError,
  SourcesFeedbackPartial,
} from "@/components/app/sources/source-feedback";
import {
  SourceConfigureButton,
  SourceRow,
  SourceToggle,
} from "@/components/app/sources/source-row";
import { PageHeader } from "@/components/app/page-header";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { summarizeConnection } from "@/components/app/gateways/gateway-connection-state";
import type { GatewayConnectionPresentation } from "@/components/app/gateways/gateways-state";
import { useApiClient } from "@/lib/api-client";
import type { Gateway, Source } from "@/lib/types";
import {
  applySourceToggleFailure,
  applySourceToggleSuccess,
  canToggleSource,
  findSourceByType,
  gatewayHintKind,
  hasPartialSources,
  SOURCE_DISPLAY_TYPES,
  sourceAvailability,
  sourceConfigureHref,
  sourceGroup,
  sourcesSurfaceState,
  type KnownSourceType,
  type SourceAvailability,
} from "@/components/app/sources/sources-state";

const PROVIDER_KEYS: Record<KnownSourceType, string> = {
  gutenberg: "gutenberg",
  standard_ebooks: "standardEbooks",
  upload: "upload",
  torrent_gateway: "torrentGateway",
};

export function SourcesView({
  title,
  description,
  initialSources,
  sourcesUnavailable,
}: {
  title: string;
  description: string;
  /** Kept for page.tsx contract; PageHeader uses desktop description. */
  descriptionMobile: string;
  initialSources: Source[];
  sourcesUnavailable: boolean;
}) {
  const t = useTranslations("sources");
  const tCommon = useTranslations("common");
  const { call } = useApiClient();
  const router = useRouter();
  const [sources, setSources] = useState(initialSources);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [failedToggle, setFailedToggle] = useState<Source | null>(null);
  const [partialDismissed, setPartialDismissed] = useState(false);
  const [gatewayPresentation, setGatewayPresentation] = useState<
    GatewayConnectionPresentation | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await call<Gateway[]>("/api/v1/gateways");
        if (cancelled) return;
        if (!Array.isArray(data)) {
          setGatewayPresentation(null);
          return;
        }
        setGatewayPresentation(summarizeConnection(data, Date.now()));
      } catch {
        if (!cancelled) setGatewayPresentation(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [call]);

  const surfaceState = sourcesSurfaceState({
    sources,
    sourcesUnavailable,
    updateError,
  });
  const partial =
    hasPartialSources(sources, sourcesUnavailable) && !partialDismissed;
  const displayedCount = SOURCE_DISPLAY_TYPES.length;

  function gatewayHintTitle(): string {
    switch (gatewayHintKind(gatewayPresentation)) {
      case "connected":
        return t("gatewayHintTitleConnected");
      case "offline":
        return t("gatewayHintTitleOffline");
      case "pending":
        return t("gatewayHintTitlePending");
      case "expired":
        return t("gatewayHintTitleExpired");
      case "revoked":
        return t("gatewayHintTitleRevoked");
      case "unknown":
        return t("gatewayHintTitleUnknown");
      default:
        return t("gatewayHintTitleNone");
    }
  }

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

  /**
   * Pen specimen « Via Gateway · 1 248 livres » — SourceOut has no book count;
   * derive qualifier · real status (never invent a livre total).
   */
  function rowMeta(
    type: KnownSourceType,
    availability: SourceAvailability
  ): ReactNode {
    if (type === "upload") {
      return (
        <>
          {t("groupLocal")}
          {" · "}
          {t("alwaysActive")}
        </>
      );
    }
    if (type === "torrent_gateway") {
      return (
        <>
          {t("gatewayLocalShort")}
          {" · "}
          {availabilityLabel(availability)}
        </>
      );
    }
    const group =
      sourceGroup(type) === "openAccess"
        ? t("groupOpenAccess")
        : t("groupLocal");
    return (
      <>
        {group} · {availabilityLabel(availability)}
      </>
    );
  }

  async function toggle(source: Source) {
    setPendingIds((prev) => new Set(prev).add(source.id));
    setUpdateError(null);
    setFailedToggle(null);
    try {
      const updated = await call<Source>(`/api/v1/sources/${source.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !source.enabled }),
      });
      setSources((prev) => applySourceToggleSuccess(prev, updated));
      toast.success(updated.enabled ? t("toastEnabled") : t("toastDisabled"));
    } catch {
      setSources((prev) => applySourceToggleFailure(prev));
      setFailedToggle(source);
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
    const providerKey = PROVIDER_KEYS[type];
    const source = findSourceByType(sources, type);
    const availability = sourceAvailability(type, sources, sourcesUnavailable);
    const pending = source ? pendingIds.has(source.id) : false;
    const toggleable = canToggleSource(type, sources, sourcesUnavailable);
    const enabled = availability === "enabled";
    const name = t(`providers.${providerKey}.name`);
    const configureHref = sourceConfigureHref(type);

    const trailing = (
      <>
        {configureHref ? (
          <SourceConfigureButton
            href={configureHref}
            label={t("configure")}
            ariaLabel={t("configureAria", { name })}
          />
        ) : null}
        {toggleable && source ? (
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
        ) : null}
      </>
    );

    const footer =
      availability === "unknown" ? (
        <p className="pl-[52px] text-xs font-medium leading-relaxed break-words whitespace-normal text-muted-foreground">
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

  const rows = (
    <Reveal>
      <div data-testid="sources-rows">
        <RevealGroup className="flex min-w-0 flex-col">
          {SOURCE_DISPLAY_TYPES.map((type) => renderRow(type))}
        </RevealGroup>
      </div>
    </Reveal>
  );

  return (
    <div
      className="flex min-w-0 flex-col gap-5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      data-testid="sources-pen-layout"
      data-sources-state={surfaceState}
    >
      <PageHeader title={title} description={description} />

      <SourcesFeedback
        icon={Cable}
        title={gatewayHintTitle()}
        description={t("gatewayHintBody")}
        data-testid="sources-gateway-hint"
        data-gateway-hint={gatewayHintKind(gatewayPresentation)}
      />

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
        <SourcesFeedbackPartial
          title={t("partialTitle")}
          description={t("partialNote")}
          ignoreLabel={tCommon("ignore")}
          onIgnore={() => setPartialDismissed(true)}
          refreshLabel={tCommon("refresh")}
          onRefresh={() => {
            setPartialDismissed(false);
            router.refresh();
          }}
        />
      ) : null}

      {updateError ? (
        <SourcesFeedbackError
          title={t("updateErrorTitle")}
          description={updateError}
          dismissLabel={tCommon("dismiss")}
          onDismiss={() => {
            setUpdateError(null);
            setFailedToggle(null);
          }}
          retryLabel={tCommon("retry")}
          onRetry={() => {
            if (failedToggle) void toggle(failedToggle);
          }}
        />
      ) : null}

      <section
        data-testid="sources-panel"
        aria-label={t("localSourcesTitle")}
        className="flex flex-col gap-1 rounded-lg border border-border-strong bg-ferry-surface px-5 py-2"
      >
        <div className="flex items-center justify-between py-3">
          <h2 className="text-base font-medium text-foreground">
            {t("localSourcesTitle")}
          </h2>
          <p className="text-xs font-medium text-muted-foreground">
            {t("localSourcesCount", { count: displayedCount })}
          </p>
        </div>
        <div data-testid="sources-body">{rows}</div>
      </section>
    </div>
  );
}
