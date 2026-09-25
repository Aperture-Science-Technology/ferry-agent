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
import { PageHeader } from "@/components/app/page-header";
import { SidebarProvider } from "@/components/ui/sidebar";
import messages from "@/messages/fr.json";

const harnessDir = dirname(fileURLToPath(import.meta.url));
const appLayoutSource = readFileSync(
  join(harnessDir, "../app/[locale]/app/layout.tsx"),
  "utf8"
);

const pathnameRef = { current: "/app/bibliotheque" };

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div data-testid="user-button" />,
  useUser: () => ({
    user: {
      fullName: "Alex Martin",
      firstName: "Alex",
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
    expect(appLayoutSource).toContain(mobileNavContentPadClass);
    // Do not leave the old inner-only pad (or none) without the main contract.
    expect(appLayoutSource).toMatch(
      /SidebarInset[\s\S]*pb-\[calc\(4\.5rem\+1px\+env\(safe-area-inset-bottom/
    );
  });
});
