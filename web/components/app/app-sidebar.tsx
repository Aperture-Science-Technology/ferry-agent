"use client";

import { UserButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  Database,
  Library,
  Radio,
  Send,
  Settings,
  Tablet,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type NavItem = {
  href:
    | "/app/bibliotheque"
    | "/app/livraisons"
    | "/app/appareils"
    | "/app/gateways"
    | "/app/sources"
    | "/app/reglages";
  labelKey:
    | "library"
    | "deliveries"
    | "devices"
    | "access"
    | "sources"
    | "settings";
  icon: typeof Library;
};

const PRIMARY: NavItem = {
  href: "/app/bibliotheque",
  labelKey: "library",
  icon: Library,
};

const TRANSFER: NavItem[] = [
  { href: "/app/livraisons", labelKey: "deliveries", icon: Send },
];

const DEVICES: NavItem[] = [
  { href: "/app/appareils", labelKey: "devices", icon: Tablet },
];

const LOCAL: NavItem[] = [
  { href: "/app/gateways", labelKey: "access", icon: Radio },
  { href: "/app/sources", labelKey: "sources", icon: Database },
];

const SETTINGS: NavItem = {
  href: "/app/reglages",
  labelKey: "settings",
  icon: Settings,
};

function isActivePath(pathname: string | null, href: string) {
  return Boolean(pathname?.startsWith(href));
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const active = isActivePath(pathname, item.href);
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={t(item.labelKey)}
        className={cn(
          "relative h-9 gap-3 rounded-md px-2.5 font-normal text-sidebar-foreground/85",
          "data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-foreground",
          "data-active:before:absolute data-active:before:inset-y-2 data-active:before:left-0 data-active:before:w-0.5 data-active:before:rounded-full data-active:before:bg-sidebar-primary"
        )}
        render={
          <Link href={item.href}>
            <Icon />
            <span>{t(item.labelKey)}</span>
          </Link>
        }
      />
    </SidebarMenuItem>
  );
}

function NavCluster({
  items,
  label,
}: {
  items: NavItem[];
  label?: string;
}) {
  return (
    <SidebarGroup className="py-1.5">
      {label ? (
        <SidebarGroupLabel className="px-2.5 text-[0.6875rem] font-medium tracking-[0.08em] text-sidebar-foreground/55 uppercase">
          {label}
        </SidebarGroupLabel>
      ) : null}
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const docsActive = Boolean(pathname?.startsWith("/docs"));

  return (
    <Sidebar collapsible="icon" enableMobileSheet={false} variant="sidebar">
      <SidebarHeader className="gap-3 border-b border-sidebar-border/70 px-3 py-4">
        <Link
          href="/app/bibliotheque"
          className="flex items-center gap-2.5 rounded-md px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
        >
          <BrandLogo markClassName="size-7" withWordmark={!collapsed} />
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-1 py-3">
        <NavCluster items={[PRIMARY]} />
        <SidebarSeparator className="my-2 bg-sidebar-border/80" />
        <NavCluster items={TRANSFER} label={t("groupTransfer")} />
        <SidebarSeparator className="my-2 bg-sidebar-border/80" />
        <NavCluster items={DEVICES} />
        <SidebarSeparator className="my-2 bg-sidebar-border/80" />
        <NavCluster items={LOCAL} label={t("groupLocal")} />
      </SidebarContent>

      <SidebarFooter className="gap-3 border-t border-sidebar-border/70 px-2 py-3">
        <SidebarMenu className="gap-0.5">
          <NavLink item={SETTINGS} />
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={docsActive}
              tooltip={t("docs")}
              className={cn(
                "relative h-9 gap-3 rounded-md px-2.5 font-normal text-sidebar-foreground/85",
                "data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-foreground",
                "data-active:before:absolute data-active:before:inset-y-2 data-active:before:left-0 data-active:before:w-0.5 data-active:before:rounded-full data-active:before:bg-sidebar-primary"
              )}
              render={
                <Link href="/docs">
                  <BookOpen />
                  <span>{t("docs")}</span>
                </Link>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>

        <div
          className={cn(
            "flex items-center gap-2 px-1",
            collapsed ? "flex-col justify-center" : "justify-between"
          )}
        >
          <LocaleSwitcher compact={collapsed} />
          <div className="flex size-8 items-center justify-center">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "size-7",
                },
              }}
            />
            <span className="sr-only">{t("account")}</span>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
