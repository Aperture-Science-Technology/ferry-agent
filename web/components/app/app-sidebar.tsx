"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
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
import { BrandMark } from "@/components/brand-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
    | "/app/sources"
    | "/app/gateways"
    | "/app/reglages";
  labelKey:
    | "library"
    | "deliveries"
    | "devices"
    | "sources"
    | "access"
    | "settings";
  icon: typeof Library;
};

/** Flat nav — Pen Shell/Sidebar order (Sources before Gateway). */
const NAV_ITEMS: NavItem[] = [
  { href: "/app/bibliotheque", labelKey: "library", icon: Library },
  { href: "/app/livraisons", labelKey: "deliveries", icon: Truck },
  { href: "/app/appareils", labelKey: "devices", icon: Tablet },
  { href: "/app/sources", labelKey: "sources", icon: Database },
  { href: "/app/gateways", labelKey: "access", icon: Cable },
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

/**
 * Pen Shell/Sidebar — 208 wide content (no own pad), footer cluster pad 8 gap 8.
 * Header = Button/Ghost brand · Footer Cluster = elevated nav + account.
 * h-svh: collapsible=none uses h-full, which cannot resolve against min-h-svh
 * on the wrapper — without an explicit viewport height the footer never sticks.
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
  const initial = (
    user?.firstName?.trim()?.charAt(0) ||
    user?.fullName?.trim()?.charAt(0) ||
    user?.primaryEmailAddress?.emailAddress?.charAt(0) ||
    "?"
  ).toUpperCase();
  const hasImage = Boolean(user?.hasImage);

  return (
    <Sidebar
      collapsible="none"
      enableMobileSheet={false}
      variant="sidebar"
      className="hidden h-svh justify-between gap-2 border-0 bg-sidebar p-0 md:flex"
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
        <div
          data-testid="sidebar-footer-card"
          className="flex w-full flex-col gap-2 rounded-lg bg-card p-2"
        >
          {/* Nav Items — pad 8, gap 4; six flat items, no group labels. */}
          <div data-testid="sidebar-nav" className="flex flex-col gap-1 p-2">
            <SidebarMenu className="gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </SidebarMenu>
          </div>

          {/* Sidebar/Account — 192×48, pad 8, gap 8, avatar 32/--avatar initial */}
          <div
            data-testid="sidebar-account"
            className="relative flex h-12 w-full min-w-0 items-center gap-2 rounded-sm p-2"
          >
            <div
              data-testid="sidebar-account-avatar"
              className="pointer-events-none flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-avatar"
              aria-hidden
            >
              {hasImage && user?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- Clerk profile URL; not a static asset
                <img
                  src={user.imageUrl}
                  alt=""
                  className="size-8 object-cover"
                />
              ) : (
                <span className="text-sm font-medium text-primary-foreground">
                  {initial}
                </span>
              )}
            </div>
            <div className="pointer-events-none min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {displayName}
              </p>
              <p className="truncate text-xs font-normal text-muted-foreground">
                {t("account")}
              </p>
            </div>
            <ChevronsUpDown
              className="pointer-events-none size-4 shrink-0 text-foreground"
              aria-hidden
            />
            {/* Invisible Clerk trigger covers the whole row (keeps account menu). */}
            <div className="absolute inset-0 [&_.cl-userButton-box]:size-full [&_.cl-userButtonTrigger]:size-full [&_.cl-userButtonTrigger]:rounded-sm [&_.cl-userButtonTrigger]:opacity-0 [&_.cl-avatarBox]:hidden">
              <UserButton
                appearance={{
                  elements: {
                    rootBox: "size-full",
                    userButtonBox: "size-full",
                    userButtonTrigger: "size-full opacity-0",
                    avatarBox: "hidden",
                  },
                }}
              />
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
