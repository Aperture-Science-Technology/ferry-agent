import { auth } from "@clerk/nextjs/server";
import { setRequestLocale } from "next-intl/server";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppMobileNav } from "@/components/app/app-mobile-nav";
import { DashboardHeader } from "@/components/app/dashboard-header";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await auth.protect();

  return (
    <SidebarProvider defaultOpen>
      {/* Desktop: persistent 224px sidebar (panel 208). Mobile: bottom nav only. */}
      <AppSidebar />
      {/*
        Mobile: reserve fixed MobileBottomNav (h 72) + safe-area under content
        (see mobileNavContentPadClass). Desktop: md:pb-0 — no unused pad.
        Inset: muted/60 fill + 1px border + rounded-xl (via SidebarInset inset).
      */}
      <SidebarInset className="min-w-0 overflow-x-hidden bg-muted/60 pb-[calc(4.5rem+1px+env(safe-area-inset-bottom,0px))] md:border md:border-border md:pb-0">
        <DashboardHeader />
        {/*
          www.nextjs.design Main: pad 32/24 (px-8 py-6), gap 24 at shell level;
          per-screen inter-block gaps stay on the page views.
        */}
        <div className="flex w-full min-w-0 flex-1 flex-col gap-6 px-8 py-6">
          {children}
        </div>
      </SidebarInset>
      <AppMobileNav />
    </SidebarProvider>
  );
}
