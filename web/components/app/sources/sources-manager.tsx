"use client";

import { useEffect, useState } from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useApiClient } from "@/lib/api-client";
import type { Source, SourceType } from "@/lib/types";

const PROVIDERS: { type: SourceType; key: string; activable: boolean; icon: LucideIcon }[] = [
  { type: "gutenberg", key: "gutenberg", activable: true, icon: BookOpen },
  { type: "standard_ebooks", key: "standardEbooks", activable: true, icon: Feather },
  { type: "upload", key: "upload", activable: false, icon: Upload },
  { type: "torrent_gateway", key: "torrentGateway", activable: false, icon: Share2 },
];

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
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    setSources(initialSources);
  }, [initialSources]);

  async function toggle(source: Source) {
    setPendingId(source.id);
    try {
      const updated = await call<Source>(`/api/v1/sources/${source.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !source.enabled }),
      });
      setSources((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast.success(updated.enabled ? t("toastEnabled") : t("toastDisabled"));
    } catch {
      toast.error(t("toastUpdateFailed"));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {sourcesUnavailable ? (
        <Alert>
          <Library />
          <AlertTitle>{t("unavailableTitle")}</AlertTitle>
          <AlertDescription>{t("unavailableNote")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card/60">
        {PROVIDERS.map((provider) => {
          const source = sources.find((s) => s.type === provider.type);
          const Icon = provider.icon;
          const pending = source ? pendingId === source.id : false;
          const enabled = source?.enabled ?? false;

          return (
            <div
              key={provider.type}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{t(`providers.${provider.key}.name`)}</p>
                  <p className="text-sm text-muted-foreground">
                    {t(`providers.${provider.key}.description`)}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-3 sm:pl-2">
                {provider.activable && source ? (
                  <>
                    <Badge variant={enabled ? "default" : "secondary"} className="max-w-full">
                      {pending ? (
                        <Loader2 className="animate-spin" />
                      ) : null}
                      <span className="truncate">
                        {enabled ? t("enabled") : t("disabled")}
                      </span>
                    </Badge>
                    <Switch
                      checked={enabled}
                      disabled={pending}
                      onCheckedChange={() => void toggle(source)}
                      aria-label={
                        enabled
                          ? t("disableAria", { name: t(`providers.${provider.key}.name`) })
                          : t("enableAria", { name: t(`providers.${provider.key}.name`) })
                      }
                    />
                  </>
                ) : (
                  <Badge variant="secondary">
                    {provider.activable ? t("enabledByDefault") : t("alwaysActive")}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
