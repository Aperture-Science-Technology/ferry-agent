/**
 * Landing « On your device » Pen LLhzT harness: 4 device cards, typography classes,
 * 1/2/4 grid, decorative visuals (aria-hidden, no focusables), id="delivered".
 * Run: npm run test:ui-harness
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { Delivered } from "@/components/marketing/delivered";
import messages from "@/messages/fr.json";

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
  "../components/marketing/delivered.tsx"
);

describe("UI harness — landing On your device Pen LLhzT", () => {
  it("renders four i18n cards, contract typography, responsive grid, and safe visuals", () => {
    const { container } = render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <Delivered />
      </NextIntlClientProvider>
    );

    const section = screen.getByTestId("landing-on-your-device");
    expect(section.id).toBe("delivered");

    const h2 = within(section).getByRole("heading", { level: 2 });
    expect(h2.className).toMatch(/text-3xl/);
    expect(h2.className).toMatch(/leading-9/);
    expect(h2.className).toMatch(/md:text-4xl/);
    expect(h2.className).toMatch(/md:leading-10/);
    expect(h2.className).toMatch(/lg:text-5xl/);
    expect(h2.className).toMatch(/lg:leading-none/);

    const cardTitles = [
      messages.landing.devices.cards.kindle.title,
      messages.landing.devices.cards.kobo.title,
      messages.landing.devices.cards.tolino.title,
      messages.landing.devices.cards.usb.title,
    ];
    const h3s = within(section).getAllByRole("heading", { level: 3 });
    expect(h3s).toHaveLength(4);
    expect(h3s.map((el) => el.textContent)).toEqual(cardTitles);

    const articles = within(section).getAllByRole("article");
    expect(articles).toHaveLength(4);

    const grid = section.querySelector(".grid.grid-cols-1");
    expect(grid).toBeTruthy();
    expect(grid!.className).toMatch(/grid-cols-1/);
    expect(grid!.className).toMatch(/md:grid-cols-2/);
    expect(grid!.className).toMatch(/lg:grid-cols-4/);
    expect(grid!.className).toMatch(/gap-4/);

    const visuals = section.querySelectorAll('[aria-hidden="true"]');
    expect(visuals.length).toBeGreaterThanOrEqual(4);
    for (const visual of visuals) {
      expect(
        visual.querySelector("button, a, input, select, textarea, [tabindex]")
      ).toBeNull();
    }

    const forbidden = [
      "Reading",
      "Ready",
      "Queued",
      "Autopilot",
      "Open Library",
      "Apple Books",
    ];
    for (const phrase of forbidden) {
      expect(section.textContent).not.toContain(phrase);
    }

    expect(container.innerHTML).not.toMatch(/style=\{\{/);
    expect(container.querySelector("[style]")).toBeNull();

    const source = readFileSync(COMPONENT_PATH, "utf8");
    expect(source).not.toMatch(/style=\{\{/);

    expect(messages.landing.how.visual.queueHeading).toBe("3 envois");
  });
});
