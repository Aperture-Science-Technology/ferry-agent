"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import {
  Cable,
  ChevronsUpDown,
  Database,
  Library,
  Settings,
  Tablet,
  Truck,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { BrandMark } from "@/components/brand-logo";
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

/** Principal — Pen Shell/Sidebar. */
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
          "h-7 w-full min-w-0 gap-2 rounded-sm p-2 text-xs text-sidebar-foreground",
          "hover:bg-accent",
          active
            ? "bg-sidebar-accent font-medium data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-foreground"
            : "bg-transparent font-normal data-active:bg-transparent",
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
      <SidebarGroupLabel className="h-auto px-2 py-0 text-xs font-medium tracking-normal text-muted-foreground normal-case">
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

/**
 * Pen Shell/Sidebar — 208 wide, pad 8, gap 8, space-between.
 * Header = Button/Ghost brand · Footer Cluster = elevated nav + account.
 */
export function AppSidebar() {
  const t = useTranslations("nav");
  const tBrand = useTranslations("brand");
  const locale = useLocale();
  const { user } = useUser();
  const displayName =
    user?.fullName?.trim() ||
    user?.firstName?.trim() ||
    user?.primaryEmailAddress?.emailAddress ||
    t("account");
  const email =
    user?.primaryEmailAddress?.emailAddress?.trim() || t("account");

  return (
    <Sidebar
      collapsible="none"
      enableMobileSheet={false}
      variant="sidebar"
      className="hidden justify-between gap-2 border-0 bg-sidebar p-2 md:flex"
    >
      <SidebarHeader className="gap-1 border-0 p-2">
        <Link
          href="/app/bibliotheque"
          className="inline-flex h-10 w-full min-w-0 items-center gap-2 rounded-full border border-border-strong bg-accent px-5 text-base font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <BrandMark className="size-4" />
          <span className="min-w-0 truncate">{tBrand("name")}</span>
        </Link>
      </SidebarHeader>

      {/* Content Slot — flex grow; nav lives in elevated footer (Shell/Sidebar + rule). */}
      <SidebarContent className="min-h-0 flex-1 gap-1 p-0" />

      <SidebarFooter className="gap-0 border-0 p-0">
        <div className="flex w-full flex-col gap-2 rounded-lg bg-card p-2">
          <div className="flex flex-col gap-1 p-2">
            <NavCluster items={PRIMARY} label={t("groupPrimary")} />
            <NavCluster items={LOCAL} label={t("groupLocal")} />
          </div>

          {/* Compact locale: single visible value (no FR · EN pair). */}
          <div className="flex justify-end px-1">
            <LocaleSwitcher compact />
          </div>

          {/* Sidebar/Account — 192×48, pad 8, gap 8, avatar 32 */}
          <div className="flex h-12 w-full min-w-0 items-center gap-2 rounded-sm p-2">
            <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-avatar">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "size-8",
                    userButtonTrigger: "size-8",
                  },
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {displayName}
              </p>
              <p className="truncate text-xs font-medium text-muted-foreground">
                {email} · {locale.toUpperCase()}
              </p>
            </div>
            <ChevronsUpDown
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
