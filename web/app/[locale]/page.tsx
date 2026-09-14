import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/marketing/site-header";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Delivered } from "@/components/marketing/delivered";
import { ValueProps } from "@/components/marketing/value-props";
import { McpSpotlight } from "@/components/marketing/mcp-spotlight";
import { Faq } from "@/components/marketing/faq";
import { SiteFooter } from "@/components/marketing/site-footer";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Delivered />
        <ValueProps />
        <McpSpotlight />
        <Faq />
      </main>
      <SiteFooter />
    </div>
  );
}
