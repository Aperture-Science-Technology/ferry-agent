/**
 * Landing FAQ + footer harness: accordion a11y, anchors, no SaaS/AI residue.
 * Pen geometry detail lives in faq-footer-pen.render.test.tsx.
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

describe("UI harness — landing FAQ and footer", () => {
  it("renders #faq as an accessible single-open accordion without Reveal fade", () => {
    renderFr(<Faq />);

    const section = screen.getByTestId("landing-faq");
    expect(section.id).toBe("faq");

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /questions\. réponses/i,
      })
    ).toBeTruthy();

    const triggers = within(section).getAllByRole("button");
    expect(triggers.length).toBe(5);
    expect(section.innerHTML).not.toMatch(/Reveal|opacity:\s*0/);

    for (const trigger of triggers) {
      expect(trigger.className).toMatch(/focus-visible:ring/);
      expect(trigger.getAttribute("aria-controls")).toBeTruthy();
    }

    expect(triggers[0]!.getAttribute("aria-expanded")).toBe("true");
    expect(section.textContent).toMatch(/en ligne/i);

    fireEvent.click(triggers[1]!);
    expect(triggers[0]!.getAttribute("aria-expanded")).toBe("false");
    expect(triggers[1]!.getAttribute("aria-expanded")).toBe("true");
    expect(section.textContent).toMatch(/gutenberg/i);

    fireEvent.click(triggers[4]!);
    expect(section.textContent).toMatch(/mcp/i);
    expect(section.textContent).toMatch(/règle automatique/i);
    expect(section.textContent).not.toMatch(/assistant ia/i);

    expect(messages.faq.items.agent.a).not.toMatch(/assistant ia|\bIA\b/i);
    expect(enMessages.faq.items.agent.a).not.toMatch(/\bAI\b/i);
    expect(messages.faq.items.cloudFirst.a).toMatch(/en ligne/i);
    expect(enMessages.faq.items.cloudFirst.a).toMatch(/online/i);
  });

  it("keeps footer routes with BrandMark lockup and real destinations only", () => {
    renderFr(<SiteFooter />);

    const footer = screen.getByTestId("landing-footer");

    expect(within(footer).getByRole("link", { name: /ferry agent/i })).toBeTruthy();
    expect(footer.textContent).toMatch(/aperture science/i);
    expect(footer.textContent).toContain(messages.footer.copyright);

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
      within(nav).getByRole("link", { name: /sur votre liseuse/i }).getAttribute(
        "href"
      )
    ).toBe("/#delivered");
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
    expect(
      within(nav).getByRole("link", { name: /^sources$/i }).getAttribute("href")
    ).toBe("/app/sources");
    expect(
      within(nav).getByRole("link", { name: /livraisons/i }).getAttribute("href")
    ).toBe("/app/livraisons");
    expect(
      within(nav).getByRole("link", { name: /gateways/i }).getAttribute("href")
    ).toBe("/app/gateways");

    expect(footer.textContent).not.toMatch(/\bEspace\b/);
    expect(footer.textContent).not.toMatch(/Workspace/i);

    for (const link of within(footer).getAllByRole("link")) {
      expect(link.className).toMatch(/focus-visible:ring/);
      const href = link.getAttribute("href");
      expect(href).toBeTruthy();
      expect(href).not.toBe("#");
    }
  });
});
