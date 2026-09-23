"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import {
  Cable,
  Database,
  Library,
  Settings,
  Tablet,
  Truck,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
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

/** Principal — Pen Shell/Sidebar DQYhS. */
const PRIMARY: NavItem[] = [
  { href: "/app/bibliotheque", labelKey: "library", icon: Library },
  { href: "/app/livraisons", labelKey: "deliveries", icon: Truck },
  { href: "/app/appareils", labelKey: "devices", icon: Tablet },
];

/** Chez vous — Gateway uses cable (Pen). */
const LOCAL: NavItem[] = [
  { href: "/app/gateways", labelKey: "access", icon: Cable },
  { href: "/app/sources", labelKey: "sources", icon: Database },
  { href: "/app/reglages", labelKey: "settings", icon: Settings },
];

function isActivePath(pathname: string | null, href: string) {
  return Boolean(pathname?.startsWith(href));
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const active = isActivePath(pathname, item.href);
  const Icon = item.icon;
  const label = t(item.labelKey);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "h-auto min-w-0 gap-2.5 rounded-sm px-3 py-2.5 text-sm font-medium text-sidebar-foreground",
          "data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-foreground",
          "data-active:before:hidden"
        )}
        render={
          <Link href={item.href}>
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{label}</span>
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
  label: string;
}) {
  return (
    <SidebarGroup className="gap-1 p-0">
      <SidebarGroupLabel className="h-auto px-3 py-0 text-[11px] font-medium tracking-normal text-muted-foreground normal-case">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {items.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function CopperMark() {
  return (
    <span className="size-5 shrink-0 rounded-[6px] bg-primary" aria-hidden />
  );
}

/**
 * Pen Shell/Sidebar DQYhS — 240×fill, pad [24,16], gap 24.
 * Desktop only (ui/sidebar hides below md when enableMobileSheet=false).
 */
export function AppSidebar() {
  const t = useTranslations("nav");
  const tBrand = useTranslations("brand");
  const { user } = useUser();
  const displayName =
    user?.fullName?.trim() ||
    user?.firstName?.trim() ||
    user?.primaryEmailAddress?.emailAddress ||
    t("account");

  return (
    <Sidebar collapsible="none" enableMobileSheet={false} variant="sidebar">
      <SidebarHeader className="gap-0 border-0 px-4 pt-6 pb-0">
        <Link
          href="/app/bibliotheque"
          className="flex min-w-0 items-center gap-2.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <CopperMark />
          <span className="font-heading text-base font-medium text-sidebar-foreground">
            {tBrand("name")}
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-6 px-4 pt-6">
        <NavCluster items={PRIMARY} label={t("groupPrimary")} />
        <NavCluster items={LOCAL} label={t("groupLocal")} />
      </SidebarContent>

      <SidebarFooter className="gap-2 border-0 px-4 pb-6">
        {/* Locale is not in Pen account card; keep compact control for i18n without altering Account geometry. */}
        <div className="flex justify-end px-1">
          <LocaleSwitcher compact />
        </div>
        <div className="flex min-w-0 items-center gap-2.5 rounded-md bg-ferry-surface-2 p-3">
          <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "size-7",
                  userButtonTrigger: "size-7",
                },
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {displayName}
            </p>
            <p className="text-xs font-medium text-muted-foreground">
              {t("account")}
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
