/**
 * Landing FAQ + footer Pen harness: accordion (single open), real footer hrefs only.
 * Run: npm run test:ui-harness
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { Faq } from "@/components/marketing/faq";
import { SiteFooter } from "@/components/marketing/site-footer";
import messages from "@/messages/fr.json";

const FAQ_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../components/marketing/faq.tsx"
);
const FOOTER_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../components/marketing/site-footer.tsx"
);

const KNOWN_HREFS = new Set([
  "/",
  "/#how-it-works",
  "/#delivered",
  "/#faq",
  "/docs",
  "/app/bibliotheque",
  "/app/sources",
  "/app/livraisons",
  "/app/gateways",
]);

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

describe("UI harness — landing FAQ + footer Pen", () => {
  it("renders five FAQ questions in Pen order with single-open accordion", () => {
    const { container } = renderFr(<Faq />);

    const section = screen.getByTestId("landing-faq");
    expect(section.id).toBe("faq");

    const triggers = within(section).getAllByRole("button");
    expect(triggers).toHaveLength(5);
    expect(triggers.map((el) => el.textContent)).toEqual([
      messages.faq.items.cloudFirst.q,
      messages.faq.items.gatewayNeeded.q,
      messages.faq.items.readers.q,
      messages.faq.items.myData.q,
      messages.faq.items.agent.q,
    ]);

    expect(triggers[0]!.getAttribute("aria-expanded")).toBe("true");
    expect(triggers[1]!.getAttribute("aria-expanded")).toBe("false");
    expect(triggers[2]!.getAttribute("aria-expanded")).toBe("false");
    expect(triggers[3]!.getAttribute("aria-expanded")).toBe("false");
    expect(triggers[4]!.getAttribute("aria-expanded")).toBe("false");

    expect(triggers[0]!.getAttribute("aria-controls")).toBeTruthy();
    expect(section.textContent).toContain(messages.faq.items.cloudFirst.a);
    expect(section.textContent).not.toContain(messages.faq.items.gatewayNeeded.a);

    fireEvent.click(triggers[1]!);

    expect(triggers[0]!.getAttribute("aria-expanded")).toBe("false");
    expect(triggers[1]!.getAttribute("aria-expanded")).toBe("true");
    expect(section.textContent).toContain(messages.faq.items.gatewayNeeded.a);
    expect(section.textContent).not.toContain(messages.faq.items.cloudFirst.a);

    expect(within(section).getAllByRole("button")).toHaveLength(5);
    expect(within(section).queryAllByRole("link")).toHaveLength(0);

    const forbidden = [
      "Queued",
      "Delivery Autopilot",
      "Open Library",
      "Apple Books",
      "Reading",
      "Ready",
      "natif",
    ];
    for (const phrase of forbidden) {
      expect(section.textContent).not.toContain(phrase);
    }

    expect(container.innerHTML).not.toMatch(/style=\{\{/);
    expect(container.querySelector("[style]")).toBeNull();
    expect(readFileSync(FAQ_PATH, "utf8")).not.toMatch(/style=\{\{/);
  });

  it("renders footer with only known real hrefs and copyright", () => {
    const { container } = renderFr(<SiteFooter />);

    const footer = screen.getByTestId("landing-footer");
    expect(footer.textContent).toContain(messages.footer.copyright);
    expect(footer.textContent).toContain(
      "© 2026 Ferry Agent. Conçu par Aperture Science Technology."
    );

    const anchors = within(footer).getAllByRole("link");
    const hrefs = anchors.map((a) => a.getAttribute("href"));

    for (const href of hrefs) {
      expect(href).toBeTruthy();
      expect(href).not.toBe("#");
      expect(href).not.toBe("undefined");
      expect(KNOWN_HREFS.has(href!)).toBe(true);
    }

    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/",
        "/#how-it-works",
        "/#delivered",
        "/app/bibliotheque",
        "/app/sources",
        "/docs",
        "/#faq",
        "/app/livraisons",
        "/app/gateways",
      ])
    );

    const forbidden = [
      "Queued",
      "Delivery Autopilot",
      "Open Library",
      "Apple Books",
      "Reading",
      "Ready",
      "natif",
      "Status",
      "Changelog",
      "Privacy",
      "Terms",
      "Security",
      "DPA",
    ];
    for (const phrase of forbidden) {
      expect(footer.textContent).not.toContain(phrase);
    }

    expect(container.innerHTML).not.toMatch(/style=\{\{/);
    expect(container.querySelector("[style]")).toBeNull();
    expect(readFileSync(FOOTER_PATH, "utf8")).not.toMatch(/style=\{\{/);
    expect(readFileSync(FOOTER_PATH, "utf8")).not.toMatch(/Socials|Globe|Github|Mail/);
  });
});
