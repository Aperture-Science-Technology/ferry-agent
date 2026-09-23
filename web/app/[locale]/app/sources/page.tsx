import { getTranslations, setRequestLocale } from "next-intl/server";
import { SourcesView } from "@/components/app/sources/sources-view";
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
  const sources = await safeApiFetch<Source[]>("/api/v1/sources");

  return (
    <SourcesView
      title={t("title")}
      description={t("description")}
      descriptionMobile={t("descriptionMobile")}
      initialSources={sources ?? []}
      sourcesUnavailable={sources === null}
    />
  );
}
