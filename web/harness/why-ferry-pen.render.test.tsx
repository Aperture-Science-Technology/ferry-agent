/**
 * Landing « Why Ferry » Pen LLhzT harness: Why & AI envelope, 3 cards, 01/02/03,
 * i18n titles/bodies, column→3-col at lg (1024), decorative visuals, no focusables.
 * Run: npm run test:ui-harness
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { ValueProps } from "@/components/marketing/value-props";
import messages from "@/messages/fr.json";

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
  const passthrough = ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) =>
    React.createElement("div", props, children);

  return {
    motion: {
      div: passthrough,
      article: (
        props: React.HTMLAttributes<HTMLElement> & {
          children?: React.ReactNode;
        }
      ) => React.createElement("article", props),
    },
    useReducedMotion: () => false,
  };
});

const COMPONENT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../components/marketing/value-props.tsx"
);

describe("UI harness — landing Why Ferry Pen LLhzT", () => {
  it("renders three i18n cards, envelope, responsive grid classes, and safe visuals", () => {
    const { container } = render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <ValueProps />
      </NextIntlClientProvider>
    );

    const section = screen.getByTestId("landing-value-props");
    expect(section.className).toMatch(/bg-white\/3/);

    const h2 = within(section).getByRole("heading", { level: 2 });
    expect(h2.textContent).toBe(messages.valueProps.title);
    expect(h2.className).toMatch(/text-3xl/);
    expect(h2.className).toMatch(/leading-9/);
    expect(h2.className).toMatch(/md:text-4xl/);
    expect(h2.className).toMatch(/md:leading-10/);
    expect(h2.className).toMatch(/lg:text-5xl/);
    expect(h2.className).toMatch(/lg:leading-none/);
    expect(h2.className).toMatch(/font-semibold/);
    expect(h2.className).toMatch(/tracking-\[-1\.2px\]/);

    expect(section.textContent).toContain(messages.valueProps.eyebrow);
    expect(section.textContent).toContain(messages.valueProps.lead);

    const cardTitles = [
      messages.valueProps.items.cloudFirst.title,
      messages.valueProps.items.legal.title,
      messages.valueProps.items.gatewayOptional.title,
    ];
    const cardBodies = [
      messages.valueProps.items.cloudFirst.body,
      messages.valueProps.items.legal.body,
      messages.valueProps.items.gatewayOptional.body,
    ];
    const h3s = within(section).getAllByRole("heading", { level: 3 });
    expect(h3s).toHaveLength(3);
    expect(h3s.map((el) => el.textContent)).toEqual(cardTitles);
    for (const h3 of h3s) {
      expect(h3.className).toMatch(/text-\[18px\]/);
      expect(h3.className).toMatch(/font-semibold/);
    }

    const articles = within(section).getAllByRole("article");
    expect(articles).toHaveLength(3);
    articles.forEach((article, i) => {
      expect(article.textContent).toContain(cardBodies[i]);
      expect(article.textContent).toContain(String(i + 1).padStart(2, "0"));
    });

    const grid = section.querySelector(".grid.grid-cols-1");
    expect(grid).toBeTruthy();
    expect(grid!.className).toMatch(/grid-cols-1/);
    expect(grid!.className).toMatch(/lg:grid-cols-3/);
    expect(grid!.className).toMatch(/gap-4/);
    expect(grid!.className).not.toMatch(/md:grid-cols/);

    const visuals = section.querySelectorAll('[aria-hidden="true"]');
    expect(visuals.length).toBeGreaterThanOrEqual(3);
    for (const visual of visuals) {
      expect(
        visual.querySelector("button, a, input, select, textarea, [tabindex]")
      ).toBeNull();
    }

    const images = section.querySelectorAll("img");
    expect(images.length).toBe(3);
    for (const img of images) {
      expect(img.getAttribute("alt")).toBe("");
    }

    const focusables = section.querySelectorAll(
      "button, a, input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    expect(focusables).toHaveLength(0);

    const forbidden = [
      "Reading",
      "Ready",
      "Queued",
      "Autopilot",
      "Open Library",
      "Apple Books",
      "Delivery Autopilot",
    ];
    for (const phrase of forbidden) {
      expect(section.textContent).not.toContain(phrase);
    }

    expect(container.innerHTML).not.toMatch(/style=\{\{/);
    expect(container.querySelector("[style]")).toBeNull();

    const source = readFileSync(COMPONENT_PATH, "utf8");
    expect(source).not.toMatch(/style=\{\{/);
    expect(source).toMatch(/useReducedMotion/);
    expect(source).toMatch(/ease:\s*"easeOut"/);
    expect(source).toMatch(/from-background to-white\/3/);
    expect(source).toMatch(/h-20 md:h-\[140px\]/);
    expect(source).toMatch(/gap-16 md:gap-24/);
    expect(source).toMatch(/pt-8 md:pt-12/);
    expect(source).toMatch(/text-\[18px\]/);
    expect(messages.valueProps.items.cloudFirst.title).toBe(
      "Votre bibliothèque, en ligne."
    );
  });
});
