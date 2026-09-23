/**
 * Landing FAQ + footer harness: accordion a11y, anchors, no SaaS/AI residue.
 * Run: npm run test:ui-harness
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { Faq } from "@/components/marketing/faq";
import { SiteFooter } from "@/components/marketing/site-footer";
import messages from "@/messages/fr.json";
import enMessages from "@/messages/en.json";

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

function renderFr(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

function assertNoCardWall(root: HTMLElement) {
  expect(root.className).not.toMatch(/bg-card|rounded-2xl|shadow-lg/);
  expect(root.querySelector("[class*='rounded-2xl']")).toBeNull();
  expect(root.querySelector("[class*='shadow-lg']")).toBeNull();
  expect(root.querySelectorAll("[class*='bg-card']").length).toBe(0);
}

describe("UI harness — landing FAQ and footer", () => {
  it("renders #faq as an editorial accordion without Reveal fade or SaaS cards", () => {
    renderFr(<Faq />);

    const section = screen.getByTestId("landing-faq");
    expect(section.id).toBe("faq");
    assertNoCardWall(section);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /questions fréquentes/i,
      })
    ).toBeTruthy();

    const triggers = within(section).getAllByRole("button");
    expect(triggers.length).toBe(5);
    expect(section.querySelector("[data-slot='accordion']")).toBeTruthy();
    expect(section.innerHTML).not.toMatch(/Reveal|opacity:\s*0/);

    for (const trigger of triggers) {
      expect(trigger.className).toMatch(/focus-visible:ring/);
    }

    fireEvent.click(triggers[0]!);
    expect(section.textContent).toMatch(/en ligne|héberg/i);

    fireEvent.click(triggers[1]!);
    expect(section.textContent).toMatch(/gutenberg/i);

    fireEvent.click(triggers[4]!);
    expect(section.textContent).toMatch(/claude|chatgpt/i);
    expect(section.textContent).not.toMatch(/assistant ia/i);

    expect(messages.faq.items.agent.a).not.toMatch(/assistant ia|\bIA\b/i);
    expect(enMessages.faq.items.agent.a).not.toMatch(/\bAI\b/i);
    expect(messages.faq.items.cloudFirst.a).toMatch(/en ligne|héberg/i);
    expect(enMessages.faq.items.cloudFirst.a).toMatch(/online|hosted/i);
  });

  it("keeps footer routes and BrandLogo lockup with library wording", () => {
    renderFr(<SiteFooter />);

    const footer = screen.getByTestId("landing-footer");
    assertNoCardWall(footer);

    expect(within(footer).getByText(/ferry agent/i)).toBeTruthy();
    expect(within(footer).getByText(/aperture science/i)).toBeTruthy();

    const home = within(footer).getByRole("link", { name: /ferry agent/i });
    expect(home.getAttribute("href")).toBe("/");

    const nav = within(footer).getByRole("navigation", {
      name: /pied de page/i,
    });
    expect(
      within(nav).getByRole("link", { name: /comment ça marche/i }).getAttribute(
        "href"
      )
    ).toBe("/#how-it-works");
    expect(
      within(nav).getByRole("link", { name: /^faq$/i }).getAttribute("href")
    ).toBe("/#faq");
    expect(
      within(nav).getByRole("link", { name: /^guide$/i }).getAttribute("href")
    ).toBe("/docs");
    expect(
      within(nav).getByRole("link", { name: /bibliothèque/i }).getAttribute(
        "href"
      )
    ).toBe("/app/bibliotheque");

    expect(footer.textContent).not.toMatch(/\bEspace\b/);
    expect(footer.textContent).not.toMatch(/Workspace/i);

    for (const link of within(nav).getAllByRole("link")) {
      expect(link.className).toMatch(/focus-visible:ring/);
    }
  });
});
