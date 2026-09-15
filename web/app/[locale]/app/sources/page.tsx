import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { SourcesManager } from "@/components/app/sources/sources-manager";
import { safeApiFetch } from "@/lib/api";
import type { Source } from "@/lib/types";

export default async function SourcesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages.sources");
  const tSources = await getTranslations("sources");
  const sources = await safeApiFetch<Source[]>("/api/v1/sources");

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="mx-auto max-w-2xl space-y-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {tSources("intro")}
        </p>
        <SourcesManager
          initialSources={sources ?? []}
          sourcesUnavailable={sources === null}
        />
      </div>
    </div>
  );
}
