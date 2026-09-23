/**
 * Shell behaviour: mobile Plus opens secondary destinations; active route is announced.
 * Run: npm run test:ui-harness
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { AppMobileNav } from "@/components/app/app-mobile-nav";
import { AppSidebar } from "@/components/app/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import messages from "@/messages/fr.json";

const pathnameRef = { current: "/app/bibliotheque" };

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div data-testid="user-button" />,
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
    expect(within(sheet).getByRole("heading", { name: "Menu" })).toBeTruthy();
    expect(within(sheet).getByRole("link", { name: "Gateway" })).toBeTruthy();
    expect(within(sheet).getByRole("link", { name: "Sources" })).toBeTruthy();
    expect(within(sheet).getByRole("link", { name: "Réglages" })).toBeTruthy();
    expect(within(sheet).getByRole("link", { name: "Guide" })).toBeTruthy();
    expect(within(sheet).getByText("Langue")).toBeTruthy();
    expect(within(sheet).getByText("Compte")).toBeTruthy();
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
});
