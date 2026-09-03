import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ByoInstallGuide } from "@/components/docs/byo-install-guide";

export const metadata: Metadata = {
  title: "Docs — Gateway BYO | Ferry Agent",
  description:
    "Tutoriel d'installation du gateway BYO Ferry Agent : Docker ou OrbStack, pairing, install.sh et Prowlarr.",
};

export default function DocsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">
        <ByoInstallGuide />
      </main>
      <SiteFooter />
    </div>
  );
}
