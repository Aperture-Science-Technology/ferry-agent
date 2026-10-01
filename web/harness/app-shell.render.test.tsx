/**
 * Shell behaviour: mobile Plus opens secondary destinations; active route is announced.
 * Run: npm run test:ui-harness
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import {
  AppMobileNav,
  mobileNavContentPadClass,
} from "@/components/app/app-mobile-nav";
import { AppSidebar } from "@/components/app/app-sidebar";
import { DashboardHeader } from "@/components/app/dashboard-header";
import { PageHeader } from "@/components/app/page-header";
import { SidebarProvider } from "@/components/ui/sidebar";
import messages from "@/messages/fr.json";

const harnessDir = dirname(fileURLToPath(import.meta.url));
const appLayoutSource = readFileSync(
  join(harnessDir, "../app/[locale]/app/layout.tsx"),
  "utf8"
);
const appSidebarSource = readFileSync(
  join(harnessDir, "../components/app/app-sidebar.tsx"),
  "utf8"
);
const dashboardHeaderSource = readFileSync(
  join(harnessDir, "../components/app/dashboard-header.tsx"),
  "utf8"
);
const globalsCssSource = readFileSync(
  join(harnessDir, "../app/globals.css"),
  "utf8"
);
const libraryViewSource = readFileSync(
  join(harnessDir, "../components/app/library/library-view.tsx"),
  "utf8"
);

const pathnameRef = { current: "/app/bibliotheque" };

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div data-testid="user-button" />,
  useUser: () => ({
    user: {
      fullName: "Alex Martin",
      firstName: "Alex",
      hasImage: false,
      imageUrl: undefined,
      primaryEmailAddress: { emailAddress: "alex@example.com" },
    },
  }),
}));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => pathnameRef.current,
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function renderShell(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("UI harness — app shell", () => {
  it("marks the current primary route and opens Plus secondary destinations", () => {
    pathnameRef.current = "/app/bibliotheque";

    renderShell(<AppMobileNav />);

    const library = screen.getByRole("link", { name: "Bibliothèque" });
    expect(library.getAttribute("aria-current")).toBe("page");

    const deliveries = screen.getByRole("link", { name: "Livraisons" });
    expect(deliveries.getAttribute("aria-current")).toBeNull();

    const more = screen.getByRole("button", { name: "Plus" });
    expect(more.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(more);

    expect(more.getAttribute("aria-expanded")).toBe("true");
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "Plus" })).toBeTruthy();
    expect(within(sheet).getByRole("link", { name: "Gateway" })).toBeTruthy();
    expect(within(sheet).getByRole("link", { name: "Sources" })).toBeTruthy();
    expect(within(sheet).getByRole("link", { name: "Réglages" })).toBeTruthy();
    expect(within(sheet).getByRole("link", { name: "Guide" })).toBeTruthy();
    expect(within(sheet).getByText("Langue")).toBeTruthy();
    expect(within(sheet).getByText("Alex Martin")).toBeTruthy();
    expect(within(sheet).getByText(/alex@example\.com/)).toBeTruthy();
    expect(within(sheet).getByTestId("user-button")).toBeTruthy();

    const mobileAvatar = within(sheet).getByTestId(
      "mobile-more-account-avatar"
    );
    expect(mobileAvatar.className).toMatch(/(?:^|\s)size-8(?:\s|$)/);
    expect(mobileAvatar.className).toMatch(/(?:^|\s)rounded-md(?:\s|$)/);
    expect(mobileAvatar.className).toMatch(/bg-secondary/);
    expect(mobileAvatar.className).not.toMatch(/bg-avatar/);
    const mobileInitial = within(mobileAvatar).getByText("A");
    expect(mobileInitial).toBeTruthy();
    expect(mobileInitial.className).toMatch(/text-foreground/);
    expect(mobileInitial.className).not.toMatch(/text-primary-foreground/);
    expect(mobileAvatar.querySelector("img")).toBeNull();
  });

  it("marks Gateway as the current page in the desktop sidebar", () => {
    pathnameRef.current = "/app/gateways";

    renderShell(
      <SidebarProvider defaultOpen>
        <AppSidebar />
      </SidebarProvider>
    );

    const gateway = screen.getByRole("link", { name: "Gateway" });
    const gatewayCurrent =
      gateway.getAttribute("aria-current") === "page" ||
      gateway.closest("[aria-current='page']") !== null;
    expect(gatewayCurrent).toBe(true);

    const library = screen.getByRole("link", { name: "Bibliothèque" });
    expect(library.getAttribute("aria-current")).not.toBe("page");
    expect(library.closest("[aria-current='page']")).toBeNull();
  });

  it("keeps a single flat Pen-ordered nav in the desktop sidebar", () => {
    // Lot 12 / Shell/Sidebar (DQYhS): six items, Sources before Gateway,
    // no group labels, no locale control in the sidebar.
    pathnameRef.current = "/app/bibliotheque";

    renderShell(
      <SidebarProvider defaultOpen>
        <AppSidebar />
      </SidebarProvider>
    );

    const nav = screen.getByTestId("sidebar-nav");
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      "Bibliothèque",
      "Livraisons",
      "Appareils",
      "Sources",
      "Gateway",
      "Réglages",
    ]);

    expect(screen.queryByText("Principal")).toBeNull();
    expect(screen.queryByText("Chez vous")).toBeNull();
    expect(screen.queryByRole("button", { name: /FR|EN|Langue/i })).toBeNull();
    expect(screen.queryByText("FR")).toBeNull();

    expect(screen.getByText("Compte")).toBeTruthy();
    expect(screen.queryByText(/alex@example\.com/)).toBeNull();

    const footerCard = screen.getByTestId("sidebar-footer-card");
    expect(footerCard.className).toMatch(/(?:^|\s)w-full(?:\s|$)/);
    expect(footerCard.className).toMatch(/(?:^|\s)p-2(?:\s|$)/);
    expect(footerCard.className).toMatch(/bg-muted\/60/);
    expect(footerCard.className).not.toMatch(/bg-card/);

    const sidebar = footerCard.closest("[data-slot='sidebar']");
    expect(sidebar).toBeTruthy();
    expect(sidebar!.getAttribute("data-variant")).toBe("inset");

    const sidebarContainer = footerCard.closest(
      "[data-slot='sidebar-container']"
    );
    expect(sidebarContainer).toBeTruthy();
    // Lot 18: inset p-2 wins (outer 8px); no p-0 override — panel stays 208 in 224.
    expect(sidebarContainer!.className).toMatch(/(?:^|\s)p-2(?:\s|$)/);
    expect(sidebarContainer!.className).not.toMatch(/(?:^|\s)p-0(?:\s|$)/);
    expect(sidebarContainer!.className).toMatch(/(?:^|\s)h-svh(?:\s|$)/);
    // Container className must not force p-0 over the inset variant’s p-2.
    const sidebarRootClass = appSidebarSource.match(
      /<Sidebar\s[^>]*className=["']([^"']*)["']/
    )?.[1];
    expect(sidebarRootClass).toBeTruthy();
    expect(sidebarRootClass).toMatch(/(?:^|\s)h-svh(?:\s|$)/);
    expect(sidebarRootClass).not.toMatch(/(?:^|\s)p-0(?:\s|$)/);

    // Lot 17: inset + offcanvas (not collapsible=none / variant=sidebar).
    expect(appSidebarSource).toMatch(/variant=["']inset["']/);
    expect(appSidebarSource).toMatch(/collapsible=["']offcanvas["']/);
    expect(appSidebarSource).not.toMatch(/variant=["']sidebar["']/);
    expect(appSidebarSource).not.toMatch(/collapsible=["']none["']/);

    const account = screen.getByTestId("sidebar-account");
    expect(account.className).toMatch(/(?:^|\s)h-12(?:\s|$)/);
    expect(account.className).toMatch(/(?:^|\s)rounded-sm(?:\s|$)/);
    expect(within(account).getByText("Alex Martin")).toBeTruthy();
    expect(within(account).getByText("Compte")).toBeTruthy();
    expect(within(account).getByTestId("user-button")).toBeTruthy();

    const avatar = screen.getByTestId("sidebar-account-avatar");
    expect(avatar.className).toMatch(/(?:^|\s)size-8(?:\s|$)/);
    expect(avatar.className).toMatch(/(?:^|\s)rounded-md(?:\s|$)/);
    expect(avatar.className).toMatch(/bg-secondary/);
    expect(avatar.className).not.toMatch(/bg-avatar/);
    const avatarInitial = within(avatar).getByText("A");
    expect(avatarInitial).toBeTruthy();
    expect(avatarInitial.className).toMatch(/text-foreground/);
    expect(avatarInitial.className).not.toMatch(/text-primary-foreground/);
    expect(avatar.querySelector("img")).toBeNull();
  });

  it("locks Lot 18 shell tokens, inset fill, and sidebar width", () => {
    expect(globalsCssSource).toMatch(/--sidebar:\s*#171717;/);
    expect(globalsCssSource).toMatch(/--sidebar-accent:\s*#262626;/);
    expect(globalsCssSource).toMatch(/--sidebar-border:\s*#ffffff1a;/);
    expect(globalsCssSource).toMatch(/--fa-sidebar-width:\s*224px;/);
    expect(globalsCssSource).not.toMatch(/--fa-sidebar-width:\s*208px;/);
    // Surface contrast: --sidebar must differ from --background.
    expect(globalsCssSource).toMatch(/--background:\s*#0a0a0a;/);
    expect(globalsCssSource).not.toMatch(/--sidebar:\s*#0a0a0a;/);

    expect(appLayoutSource).toMatch(
      /SidebarInset[\s\S]*bg-muted\/60[\s\S]*md:border[\s\S]*md:border-border/
    );
    expect(appLayoutSource).toMatch(/bg-muted\/60/);
    expect(appLayoutSource).toMatch(/md:border md:border-border/);
    expect(appLayoutSource).not.toMatch(/SidebarInset[^>]*bg-background/);
  });

  it("locks Lot 19 nextjs.design token alignment (card, muted, border)", () => {
    // Opaque card (was #26262699 translucent).
    expect(globalsCssSource).toMatch(/--card:\s*#171717;/);
    expect(globalsCssSource).not.toMatch(/--card:\s*#26262699;/);
    expect(globalsCssSource).toMatch(/--card-solid:\s*#171717;/);
    expect(globalsCssSource).toMatch(/--muted:\s*#262626;/);
    expect(globalsCssSource).toMatch(/--border:\s*#ffffff1a;/);
    expect(globalsCssSource).not.toMatch(/--border:\s*#ffffff0d;/);
    expect(globalsCssSource).toMatch(/--border-strong:\s*#ffffff26;/);
    expect(globalsCssSource).not.toMatch(/--border-strong:\s*#ffffff1a;/);
  });

  it("locks inset panel border and desktop SidebarTrigger for offcanvas reopen", () => {
    // Lot 18: one h-16 shell header — trigger 28×28 + vertical separator 1×16.
    // No Lot-17 56px strip; PageHeader remains the first content block.
    pathnameRef.current = "/app/bibliotheque";

    renderShell(
      <SidebarProvider defaultOpen>
        <DashboardHeader />
      </SidebarProvider>
    );

    const shellHeader = screen.getByTestId("dashboard-shell-header");
    expect(shellHeader.tagName.toLowerCase()).toBe("header");
    expect(shellHeader.className).toMatch(/(?:^|\s)h-16(?:\s|$)/);
    expect(shellHeader.className).not.toMatch(/h-\[56px\]/);
    expect(shellHeader.className).not.toMatch(/(?:^|\s)h-14(?:\s|$)/);

    const trigger = within(shellHeader).getByRole("button");
    expect(trigger.className).toMatch(/(?:^|\s)size-7(?:\s|$)/);
    expect(trigger.className).toMatch(/(?:^|\s)rounded-sm(?:\s|$)/);
    expect(trigger.className).not.toMatch(/(?:^|\s)size-10(?:\s|$)/);

    const separator = within(shellHeader).getByRole("separator");
    expect(separator.className).toMatch(/(?:^|\s)h-4(?:\s|$)/);

    expect(dashboardHeaderSource).toMatch(/SidebarTrigger/);
    expect(dashboardHeaderSource).toMatch(
      /from ["']@\/components\/ui\/sidebar["']/
    );
    expect(dashboardHeaderSource).toMatch(/Separator/);
    expect(dashboardHeaderSource).toMatch(/size-7/);
    expect(dashboardHeaderSource).toMatch(/(?:^|\s|["'])h-16(?:\s|["'])/);
    expect(dashboardHeaderSource).not.toMatch(
      /hidden shrink-0 items-center gap-4 p-2 md:flex/
    );

    expect(appLayoutSource).toMatch(
      /SidebarInset[\s\S]*md:border[\s\S]*md:border-border/
    );
  });

  it("locks ordinary Main pad and Header/Page geometry in layout/source", () => {
    // Lot 18: Main pad 32/24 (px-8 py-6); Header/Page h 88 unchanged.
    expect(appLayoutSource).toMatch(/(?:^|\s|["'])px-8(?:\s|["'])/);
    expect(appLayoutSource).toMatch(/(?:^|\s|["'])py-6(?:\s|["'])/);
    expect(appLayoutSource).not.toMatch(/md:px-10/);
    expect(appLayoutSource).not.toMatch(/md:py-8/);
    expect(appLayoutSource).not.toMatch(/(?:^|\s|["'])px-5(?:\s|["'])/);
    expect(appLayoutSource).not.toMatch(/rounded-lg/);
    expect(appLayoutSource).not.toMatch(/bg-card/);

    // Lot 18b library grid: 6×~174 at 1440 (minmax 150, not 140/172).
    expect(libraryViewSource).toMatch(/minmax\(150px,1fr\)/);
    expect(libraryViewSource).not.toMatch(/minmax\(140px/);
    expect(libraryViewSource).not.toMatch(/minmax\(172px/);

    renderShell(
      <PageHeader title="Bibliothèque" description="Retrouver dans mes livres" />
    );
    const title = screen.getByRole("heading", {
      level: 1,
      name: "Bibliothèque",
    });
    expect(title.className).toMatch(/text-\[28px\]/);
    expect(title.className).toMatch(/font-bold/);
    expect(title.className).toMatch(/tracking-\[-0\.5px\]/);
    expect(title.className).not.toMatch(/text-\[32px\]/);
    expect(title.className).not.toMatch(/md:text-\[40px\]/);
    expect(title.className).not.toMatch(/font-black/);

    const description = screen.getByText("Retrouver dans mes livres");
    expect(description.className).toMatch(/text-sm/);
    expect(description.className).toMatch(/font-medium/);
    expect(description.className).toMatch(/text-muted-foreground/);
    expect(description.className).not.toMatch(/max-w-\[560px\]/);
    expect(description.className).not.toMatch(/text-base/);

    const header = title.closest("div")?.parentElement;
    expect(header).toBeTruthy();
    expect(header!.className).toMatch(/h-\[88px\]/);
    expect(header!.className).toMatch(/min-h-\[88px\]/);
    expect(header!.className).toMatch(/(?:^|\s)p-2(?:\s|$)/);
    expect(header!.className).toMatch(
      /flex h-\[88px\] min-h-\[88px\] flex-wrap items-center justify-between gap-4 p-2/
    );
  });

  it("keeps PageHeader actions compressible so narrow viewports do not overflow", () => {
    // Regression for Lot 7c: PageHeader actions used shrink-0, so Appareils /
    // Gateway header clusters (~314–344px) forced document scrollWidth past 320.
    renderShell(
      <PageHeader
        title="Appareils"
        description="Gérez vos liseuses"
        action={
          <>
            <button type="button">Actualiser</button>
            <button type="button">Nouvel appareil</button>
          </>
        }
      />
    );

    const actions = screen.getByTestId("page-header-actions");
    expect(actions.className).toMatch(/min-w-0/);
    expect(actions.className).toMatch(/max-w-full/);
    expect(actions.className).toMatch(/flex-wrap/);
    expect(actions.className).not.toMatch(/(?:^|\s)shrink-0(?:\s|$)/);
  });

  it("reserves mobile bottom-nav height under main content (not on desktop)", () => {
    // Regression for Lot 7c: fixed MobileBottomNav (h 72) covered the last
    // scroll rows because main had no padding-bottom on mobile.
    renderShell(<AppMobileNav />);

    const tabs = screen.getByTestId("app-mobile-bottom-nav-tabs");
    expect(tabs.className).toMatch(/h-\[72px\]/);

    expect(mobileNavContentPadClass).toMatch(
      /pb-\[calc\(4\.5rem\+1px\+env\(safe-area-inset-bottom/
    );
    expect(mobileNavContentPadClass).toMatch(/md:pb-0/);
    // Lot 17 inserts md:border md:border-border before md:pb-0 on SidebarInset;
    // keep the mobile pad contract without requiring the exact concatenated string.
    expect(appLayoutSource).toMatch(
      /pb-\[calc\(4\.5rem\+1px\+env\(safe-area-inset-bottom,0px\)\)\]/
    );
    expect(appLayoutSource).toMatch(/md:pb-0/);
    // Do not leave the old inner-only pad (or none) without the main contract.
    expect(appLayoutSource).toMatch(
      /SidebarInset[\s\S]*pb-\[calc\(4\.5rem\+1px\+env\(safe-area-inset-bottom/
    );
  });
});
