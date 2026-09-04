"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { BookOpen, Feather, Loader2, Share2, Upload, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-3">
      <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
        {PROVIDERS.map((provider) => {
          const source = sources.find((s) => s.type === provider.type);
          const Icon = provider.icon;
          return (
            <div key={provider.type} className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t(`providers.${provider.key}.name`)}</p>
                  <p className="text-sm text-muted-foreground">
                    {t(`providers.${provider.key}.description`)}
                  </p>
                </div>
              </div>
              {provider.activable && source ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingId === source.id}
                  onClick={() => toggle(source)}
                >
                  {pendingId === source.id && <Loader2 className="animate-spin" />}
                  {source.enabled ? t("enabled") : t("disabled")}
                </Button>
              ) : (
                <Badge variant="secondary">
                  {provider.activable ? t("enabledByDefault") : t("alwaysActive")}
                </Badge>
              )}
            </div>
          );
        })}
      </div>
      {sourcesUnavailable && (
        <p className="text-sm text-muted-foreground">{t("unavailableNote")}</p>
      )}
    </div>
  );
}
