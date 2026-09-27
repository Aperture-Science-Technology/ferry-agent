/**
 * Public marketing header bar (lg): brand + nav never wrap; Pen Lang chrome;
 * no inline styles. Class assertions in jsdom — not layout measurements.
 * Run: npm run test:ui-harness
 */
import { render, screen, within } from "@testing-library/react";
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

describe("UI harness — public site header bar (Pen LLhzT Nav)", () => {
  beforeEach(() => {
    authState.signedIn = false;
  });

  it("keeps brand and desktop nav on one line with Pen Lang labels", () => {
    const { container } = render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <SiteHeader />
      </NextIntlClientProvider>
    );

    const header = screen.getByRole("banner");
    expect(header.innerHTML).not.toMatch(/style=\{\{/);
    expect(header.querySelector("[style]")).toBeNull();

    const bar = header.querySelector(".lg\\:max-w-\\[880px\\]");
    expect(bar).toBeTruthy();
    expect(bar!.className).toMatch(/lg:border-white\/15/);

    const brand = within(header).getByRole("link", { name: /ferry agent/i });
    expect(brand.className).toMatch(/shrink-0/);
    const brandWordmark = brand.querySelector(".whitespace-nowrap");
    expect(brandWordmark).toBeTruthy();
    expect(brandWordmark?.textContent).toMatch(/Ferry Agent/i);

    const desktopNav = within(header).getByRole("navigation", {
      name: /navigation/i,
    });
    expect(desktopNav.className).toMatch(/shrink-0/);

    const navLinks = within(desktopNav).getAllByRole("link");
    expect(navLinks.length).toBeGreaterThanOrEqual(4);
    for (const link of navLinks) {
      expect(link.className).toMatch(/whitespace-nowrap/);
    }

    const langGroup = within(header).getByRole("group", { name: /langue/i });
    const langButtons = within(langGroup).getAllByRole("button");
    expect(langButtons).toHaveLength(2);

    for (const btn of langButtons) {
      expect(btn.className).toMatch(/\bh-7\b/);
      expect(btn.className).toMatch(/\bpx-2\.5\b/);
      expect(btn.className).toMatch(/\brounded-lg\b/);
      expect(btn.className).toMatch(/text-\[13px\]/);
      expect(btn.className).not.toMatch(/\bh-10\b/);
      expect(btn.className).not.toMatch(/\brounded-full\b/);
      expect(btn.className).not.toMatch(/\bpx-5\b/);
    }

    const active = langButtons.find(
      (btn) => btn.getAttribute("aria-pressed") === "true"
    );
    const inactive = langButtons.find(
      (btn) => btn.getAttribute("aria-pressed") === "false"
    );
    expect(active).toBeTruthy();
    expect(inactive).toBeTruthy();
    expect(active!.className).toMatch(/font-semibold/);
    expect(inactive!.className).toMatch(/text-muted-foreground/);

    // Sanity: banner root has no inline style attribute either.
    expect(container.querySelector("header[style]")).toBeNull();
  });
});
