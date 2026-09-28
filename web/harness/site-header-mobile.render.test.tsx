/**
 * Mobile public header: accessible menu opens, exposes named nav, closes on Escape.
 * Covers signed-out and signed-in Clerk branches without bypassing Show.
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
      within(dialog).getByRole("link", { name: /se connecter/i }).getAttribute("href")
    ).toBe("/sign-in");
    expect(
      within(dialog)
        .getByRole("link", {
          name: /ouvrir l'espace/i,
        })
        .getAttribute("href")
    ).toBe("/sign-in");

    expect(trigger.className).toMatch(/min-h-11|size-11/);

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

    // Single UserButton in the header row (outside the sheet).
    expect(screen.getAllByTestId("clerk-user-button")).toHaveLength(1);
    expect(
      screen.queryByRole("link", { name: /se connecter/i })
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /ouvrir le menu/i }));

    const dialog = await screen.findByRole("dialog");
    const library = within(dialog).getByRole("link", {
      name: /ouvrir l'espace/i,
    });
    expect(library.getAttribute("href")).toBe("/app/bibliotheque");
    expect(
      within(dialog).queryByRole("link", { name: /se connecter/i })
    ).toBeNull();
  });

  it("exposes keyboard focus rings on the brand and desktop nav links", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <SiteHeader />
      </NextIntlClientProvider>
    );

    const header = screen.getByRole("banner");
    const brand = within(header).getByRole("link", { name: /ferry agent/i });
    expect(brand.className).toMatch(/focus-visible:ring/);

    // Header nav is the only navigation while the sheet is closed.
    const desktopNav = within(header).getByRole("navigation", {
      name: /navigation/i,
    });
    const how = within(desktopNav).getByRole("link", {
      name: /comment ça marche/i,
    });
    expect(how.className).toMatch(/focus-visible:ring/);
  });

  it("exposes a language control: desktop FR/EN pair and mobile menu with both languages", async () => {
    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <SiteHeader />
      </NextIntlClientProvider>
    );

    const desktopPair = screen.getByRole("group", {
      name: messages.locale.choose,
    });
    expect(
      within(desktopPair).getByRole("button", { name: messages.locale.fr })
    ).toBeTruthy();
    expect(
      within(desktopPair).getByRole("button", { name: messages.locale.en })
    ).toBeTruthy();
    expect(
      within(desktopPair)
        .getByRole("button", { name: messages.locale.fr })
        .getAttribute("aria-pressed")
    ).toBe("true");

    const mobileTrigger = screen.getByRole("button", {
      name: messages.locale.choose,
    });
    expect(mobileTrigger.textContent).toContain(messages.locale.fr);

    fireEvent.click(mobileTrigger);

    expect(
      await screen.findByRole("menuitemradio", {
        name: messages.settings.languageValueFr,
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("menuitemradio", {
        name: messages.settings.languageValueEn,
      })
    ).toBeTruthy();
  });
});
