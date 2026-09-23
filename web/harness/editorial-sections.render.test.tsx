/**
 * Landing editorial sections harness: value props, delivered destinations, MCP aside.
 * Asserts composition grammar (no SaaS card wall), anchors, product truth, docs CTA.
 * Run: npm run test:ui-harness
 */
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { Delivered } from "@/components/marketing/delivered";
import { McpSpotlight } from "@/components/marketing/mcp-spotlight";
import { ValueProps } from "@/components/marketing/value-props";
import messages from "@/messages/fr.json";

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

vi.mock("motion/react", async () => {
  const React = await import("react");
  const passthrough = (
    {
      children,
      ...props
    }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }
  ) => React.createElement("div", props, children);

  return {
    motion: {
      div: passthrough,
      ol: (
        props: React.HTMLAttributes<HTMLElement> & {
          children?: React.ReactNode;
        }
      ) => React.createElement("ol", props),
      li: (
        props: React.HTMLAttributes<HTMLElement> & {
          children?: React.ReactNode;
        }
      ) => React.createElement("li", props),
    },
    useReducedMotion: () => false,
  };
});

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

describe("UI harness — landing editorial sections", () => {
  it("renders value props as an editorial chapter with cloud/Gateway transfer, not a card grid", () => {
    renderFr(<ValueProps />);

    const section = screen.getByTestId("landing-value-props");
    assertNoCardWall(section);

    const title = screen.getByRole("heading", {
      level: 2,
      name: /pourquoi ferry agent/i,
    });
    expect(title).toBeTruthy();
    expect(section.textContent).toMatch(/héberg/i);
    expect(section.textContent).toMatch(/gutenberg/i);
    expect(section.textContent).toMatch(/gateway/i);

    const transfer = screen.getByTestId("landing-value-transfer");
    expect(transfer.querySelector("img")?.getAttribute("src")).toBe(
      "/illustrations/cloud-gateway.svg"
    );
    expect(within(transfer).getByText("En ligne")).toBeTruthy();
    expect(within(transfer).getByText("Chez vous")).toBeTruthy();
    expect(
      within(transfer).getByText(/bibliothèque vit en ligne/i)
    ).toBeTruthy();

    const valueList = within(section).getAllByRole("list").find(
      (el) => el.tagName === "OL"
    );
    expect(valueList).toBeTruthy();
    expect(within(valueList as HTMLElement).getAllByRole("listitem")).toHaveLength(
      3
    );

    const headings = within(section).getAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(3);
  });

  it("keeps #delivered as a destination register with supported channels and send limits", () => {
    renderFr(<Delivered />);

    const section = screen.getByTestId("landing-delivered");
    expect(section.id).toBe("delivered");
    assertNoCardWall(section);

    expect(
      screen.getByRole("heading", { level: 2, name: /sur votre liseuse/i })
    ).toBeTruthy();
    expect(section.textContent).toMatch(/ne confirme pas/i);

    for (const name of ["Kindle", "Kobo", "Tolino", "USB"]) {
      expect(
        within(section).getByRole("heading", { level: 3, name })
      ).toBeTruthy();
    }

    expect(section.textContent).toMatch(/email/i);
    expect(section.textContent).toMatch(/cloud/i);
    expect(section.textContent).toMatch(/code/i);
    expect(section.textContent).toMatch(/manuel|branch/i);

    // No hover-translate chrome from the previous SaaS list treatment
    expect(section.innerHTML).not.toMatch(/hover:translate/);
  });

  it("keeps #mcp as an editorial aside with docs CTA, without AI badge language", () => {
    renderFr(<McpSpotlight />);

    const section = screen.getByTestId("landing-mcp");
    expect(section.id).toBe("mcp");
    assertNoCardWall(section);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /même bibliothèque/i,
      })
    ).toBeTruthy();
    expect(section.textContent).not.toMatch(/pour les assistants ia aussi/i);

    const cta = screen.getByRole("link", { name: /voir le guide/i });
    expect(cta.getAttribute("href")).toBe("/docs");
  });
});
