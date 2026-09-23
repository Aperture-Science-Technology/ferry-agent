/**
 * Mobile public header: accessible menu opens, exposes named nav, closes on Escape.
 * Covers signed-out and signed-in Clerk branches without bypassing Show/SignInButton.
 * Run: npm run test:ui-harness
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SiteHeader } from "@/components/marketing/site-header";
import messages from "@/messages/fr.json";

const authState = vi.hoisted(() => ({ signedIn: false }));

vi.mock("@clerk/nextjs", () => ({
  Show: ({
    when,
    children,
  }: {
    when: "signed-in" | "signed-out";
    children: React.ReactNode;
  }) => {
    const visible =
      (when === "signed-in" && authState.signedIn) ||
      (when === "signed-out" && !authState.signedIn);
    return visible ? <>{children}</> : null;
  },
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UserButton: () => (
    <button type="button" data-testid="clerk-user-button">
      Compte
    </button>
  ),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("UI harness — public site header mobile menu", () => {
  beforeEach(() => {
    authState.signedIn = false;
  });

  it("opens a named navigation panel and closes on Escape, restoring focus to the trigger", async () => {
    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <SiteHeader />
      </NextIntlClientProvider>
    );

    const trigger = screen.getByRole("button", { name: /ouvrir le menu/i });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const dialog = await screen.findByRole("dialog");
    const nav = within(dialog).getByRole("navigation", {
      name: /navigation/i,
    });

    expect(
      within(nav).getByRole("link", { name: /comment ça marche/i })
    ).toBeTruthy();
    expect(within(nav).getByRole("link", { name: /faq/i })).toBeTruthy();
    expect(within(nav).getByRole("link", { name: /guide/i })).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: /connexion/i })
    ).toBeTruthy();
    expect(
      within(dialog).getByRole("button", {
        name: /ouvrir la bibliothèque/i,
      })
    ).toBeTruthy();

    await act(async () => {
      fireEvent.keyDown(dialog, {
        key: "Escape",
        code: "Escape",
        keyCode: 27,
        which: 27,
        bubbles: true,
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("keeps Clerk signed-in actions: library link in the sheet and UserButton outside", async () => {
    authState.signedIn = true;

    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <SiteHeader />
      </NextIntlClientProvider>
    );

    // Responsive branches keep two UserButton mounts; CSS shows one per viewport.
    expect(screen.getAllByTestId("clerk-user-button").length).toBeGreaterThan(
      0
    );
    expect(
      screen.queryByRole("button", { name: /connexion/i })
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /ouvrir le menu/i }));

    const dialog = await screen.findByRole("dialog");
    const library = within(dialog).getByRole("link", {
      name: /^bibliothèque$/i,
    });
    expect(library.getAttribute("href")).toBe("/app/bibliotheque");
    expect(
      within(dialog).queryByRole("button", { name: /connexion/i })
    ).toBeNull();
  });

  it("exposes keyboard focus rings on the brand and desktop nav links", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <SiteHeader />
      </NextIntlClientProvider>
    );

    const brand = screen.getByRole("link", { name: /ferry agent/i });
    expect(brand.className).toMatch(/focus-visible:ring/);

    const desktopNav = screen.getByRole("navigation", {
      name: /navigation/i,
    });
    const how = within(desktopNav).getByRole("link", {
      name: /comment ça marche/i,
    });
    expect(how.className).toMatch(/focus-visible:ring/);
  });
});
