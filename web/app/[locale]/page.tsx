import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/marketing/site-header";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Delivered } from "@/components/marketing/delivered";
import { ValueProps } from "@/components/marketing/value-props";
import { McpSpotlight } from "@/components/marketing/mcp-spotlight";
import { Faq } from "@/components/marketing/faq";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PageDecor } from "@/components/marketing/page-decor";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="relative flex flex-1 flex-col overflow-x-hidden">
      <SiteHeader />
      {/* z-[1] keeps readable/interactive content above atmosphere layers */}
      <main className="relative z-[1] flex-1">
        <Hero />
        <HowItWorks />
        <Delivered />
        <ValueProps>
          <McpSpotlight />
        </ValueProps>
        <Faq />
      </main>
      <div className="relative z-[1]">
        <SiteFooter />
      </div>
      <PageDecor />
    </div>
  );
}
