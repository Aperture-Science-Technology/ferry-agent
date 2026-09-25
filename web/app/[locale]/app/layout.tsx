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
      {/* Desktop: persistent 208px sidebar. Mobile: bottom nav only. */}
      <AppSidebar />
      {/*
        Mobile: reserve fixed MobileBottomNav (h 72) + safe-area under content
        (see mobileNavContentPadClass). Desktop: md:pb-0 — no unused pad.
      */}
      <SidebarInset className="min-w-0 overflow-x-hidden bg-background pb-[calc(4.5rem+1px+env(safe-area-inset-bottom,0px))] md:pb-0">
        <DashboardHeader />
        <div className="flex w-full min-w-0 flex-1 flex-col gap-6 px-5 pt-6 md:gap-6 md:px-10 md:py-8">
          {children}
        </div>
      </SidebarInset>
      <AppMobileNav />
    </SidebarProvider>
  );
}
