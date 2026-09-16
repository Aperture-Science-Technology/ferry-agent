import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ByoInstallGuide } from "@/components/docs/byo-install-guide";
import { getConfiguredGatewayReleaseVersion } from "@/lib/gateway-release";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "docs" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function DocsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const releaseVersion = getConfiguredGatewayReleaseVersion();

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">
        <ByoInstallGuide releaseVersion={releaseVersion} />
      </main>
      <SiteFooter />
    </div>
  );
}
