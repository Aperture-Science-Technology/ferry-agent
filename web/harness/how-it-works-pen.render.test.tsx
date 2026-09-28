/**
 * Landing « How it works » Pen LLhzT harness: 5 product cards, typography classes,
 * 2+3 grid, decorative visuals (aria-hidden, no focusables), real delivery statuses.
 * Run: npm run test:ui-harness
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { HowItWorks } from "@/components/marketing/how-it-works";
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
  "../components/marketing/how-it-works.tsx"
);

describe("UI harness — landing How it works Pen LLhzT", () => {
  it("renders five i18n cards, contract typography, 2+3 grid, and safe visuals", () => {
    const { container } = render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <HowItWorks />
      </NextIntlClientProvider>
    );

    const section = screen.getByTestId("landing-how-it-works");
    expect(section.id).toBe("how-it-works");

    const h2 = within(section).getByRole("heading", { level: 2 });
    expect(h2.className).toMatch(/text-3xl/);
    expect(h2.className).toMatch(/leading-9/);
    expect(h2.className).toMatch(/sm:text-4xl/);
    expect(h2.className).toMatch(/sm:leading-10/);
    expect(h2.className).toMatch(/md:text-5xl/);
    expect(h2.className).toMatch(/md:leading-none/);
    expect(h2.className).toMatch(/font-semibold/);
    expect(h2.className).toMatch(/tracking-\[-1\.2px\]/);

    const cardTitles = [
      messages.landing.how.cards.library.title,
      messages.landing.how.cards.send.title,
      messages.landing.how.cards.search.title,
      messages.landing.how.cards.sources.title,
      messages.landing.how.cards.queue.title,
    ];
    const h3s = within(section).getAllByRole("heading", { level: 3 });
    expect(h3s).toHaveLength(5);
    expect(h3s.map((el) => el.textContent)).toEqual(cardTitles);

    const articles = within(section).getAllByRole("article");
    expect(articles).toHaveLength(5);

    const gridRows = section.querySelectorAll(":scope > div > div.flex.flex-col.gap-2 > div");
    expect(gridRows).toHaveLength(2);
    expect(within(gridRows[0] as HTMLElement).getAllByRole("article")).toHaveLength(
      2
    );
    expect(within(gridRows[1] as HTMLElement).getAllByRole("article")).toHaveLength(
      3
    );

    const visuals = section.querySelectorAll('[aria-hidden="true"]');
    expect(visuals.length).toBeGreaterThanOrEqual(5);
    for (const visual of visuals) {
      expect(
        visual.querySelector("button, a, input, select, textarea, [tabindex]")
      ).toBeNull();
    }

    const queueCard = articles[4];
    expect(queueCard.textContent).toContain(
      messages.deliveries.statuses.delivered
    );
    expect(queueCard.textContent).toContain(messages.deliveries.statuses.queued);
    expect(queueCard.textContent).toContain(messages.deliveries.statuses.sent);

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
    expect(source).toMatch(/deliveries\.statuses/);
    expect(source).not.toMatch(/statusDelivered|statusQueued|statusSent/);

    expect(messages.landing.how.visual.queueHeading).toBe("3 envois");
  });
});
