/**
 * Landing editorial sections harness: Why Ferry product truth, delivered destinations, MCP aside.
 * Detailed Why Ferry Pen geometry lives in why-ferry-pen.render.test.tsx.
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

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    const { alt, src, className } = props;
    return (
      <img
        alt={alt ?? ""}
        src={typeof src === "string" ? src : ""}
        className={className}
      />
    );
  },
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
      article: (
        props: React.HTMLAttributes<HTMLElement> & {
          children?: React.ReactNode;
        }
      ) => React.createElement("article", props),
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
  it("keeps Why Ferry product truth: hosted library, open-access sources, optional Gateway", () => {
    renderFr(<ValueProps />);

    const section = screen.getByTestId("landing-value-props");
    expect(section.className).toMatch(/bg-white\/3/);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /bibliothèque en ligne/i,
      })
    ).toBeTruthy();
    expect(section.textContent).toMatch(/héberg/i);
    expect(section.textContent).toMatch(/gutenberg/i);
    expect(section.textContent).toMatch(/gateway/i);
    expect(section.textContent).toMatch(/optionnel/i);

    const headings = within(section).getAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(3);
    expect(headings[0].textContent).toBe(
      messages.valueProps.items.cloudFirst.title
    );
  });

  it("keeps #delivered as On your device with four supported channels", () => {
    renderFr(<Delivered />);

    const section = screen.getByTestId("landing-on-your-device");
    expect(section.id).toBe("delivered");

    expect(
      screen.getByRole("heading", { level: 2, name: /sur votre liseuse/i })
    ).toBeTruthy();

    for (const name of ["Kindle", "Kobo", "Tolino", "USB"]) {
      expect(
        within(section).getByRole("heading", { level: 3, name })
      ).toBeTruthy();
    }

    expect(section.textContent).toMatch(/e-mail|email/i);
    expect(section.textContent).toMatch(/synchronisation/i);
    expect(section.textContent).toMatch(/code/i);
    expect(section.textContent).toMatch(/câble|main/i);

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
