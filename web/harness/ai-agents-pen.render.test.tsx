/**
 * Landing « AI Agents » Pen harness: accordion (single open), routing SVG,
 * deliveries.statuses on status pill, no forbidden vocabulary / inline styles.
 * Run: npm run test:ui-harness
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { McpSpotlight } from "@/components/marketing/mcp-spotlight";
import messages from "@/messages/fr.json";
import enMessages from "@/messages/en.json";

const COMPONENT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../components/marketing/mcp-spotlight.tsx"
);

function renderFr(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("UI harness — landing AI Agents Pen", () => {
  it("renders three headers, Claude open by default, ChatGPT interaction, SVG, and product-truth status", () => {
    const { container } = renderFr(<McpSpotlight />);

    const block = screen.getByTestId("landing-mcp");
    const triggers = within(block).getAllByRole("button");
    expect(triggers).toHaveLength(3);
    expect(triggers.map((el) => el.textContent)).toEqual([
      messages.mcpSpotlight.agents.claude.name,
      messages.mcpSpotlight.agents.chatgpt.name,
      messages.mcpSpotlight.agents.mistral.name,
    ]);

    expect(triggers[0]!.getAttribute("aria-expanded")).toBe("true");
    expect(triggers[1]!.getAttribute("aria-expanded")).toBe("false");
    expect(triggers[2]!.getAttribute("aria-expanded")).toBe("false");

    expect(block.textContent).toContain(messages.mcpSpotlight.agents.claude.body);
    expect(block.textContent).not.toContain(
      messages.mcpSpotlight.agents.chatgpt.body
    );
    expect(block.textContent).not.toContain(
      messages.mcpSpotlight.agents.mistral.body
    );

    fireEvent.click(triggers[1]!);

    expect(triggers[0]!.getAttribute("aria-expanded")).toBe("false");
    expect(triggers[1]!.getAttribute("aria-expanded")).toBe("true");
    expect(triggers[2]!.getAttribute("aria-expanded")).toBe("false");
    expect(block.textContent).toContain(messages.mcpSpotlight.agents.chatgpt.body);
    expect(block.textContent).not.toContain(
      messages.mcpSpotlight.agents.claude.body
    );

    const focusables = within(block).queryAllByRole("button");
    expect(focusables).toHaveLength(3);
    expect(
      within(block).queryAllByRole("link").length +
        within(block).queryAllByRole("textbox").length
    ).toBe(0);

    const svg = block.querySelector('svg[viewBox="0 0 480 520"]');
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute("aria-hidden")).toBe("true");
    expect(svg!.getAttribute("viewBox")).toBe("0 0 480 520");
    expect(svg!.getAttribute("preserveAspectRatio")).toBe("none");
    const svgClass = svg!.getAttribute("class") ?? "";
    expect(svgClass).toMatch(/h-\[336px\]/);
    expect(svgClass).toMatch(/w-\[280px\]/);
    expect(svgClass).toMatch(/md:h-\[520px\]/);
    expect(svgClass).toMatch(/md:w-\[480px\]/);

    const statusPill = `${messages.deliveries.statuses.queued} · ${messages.landing.devices.cards.kindle.title}`;
    expect(block.textContent).toContain(statusPill);
    expect(enMessages.deliveries.statuses.queued).toBe("Requested");

    const forbidden = [
      "Queued",
      "Delivery Autopilot",
      "Open Library",
      "Apple Books",
      "Reading",
      "Ready",
    ];
    for (const phrase of forbidden) {
      expect(block.textContent).not.toContain(phrase);
    }

    expect(container.innerHTML).not.toMatch(/style=\{\{/);
    expect(container.querySelector("[style]")).toBeNull();

    const source = readFileSync(COMPONENT_PATH, "utf8");
    expect(source).not.toMatch(/style=\{\{/);
    expect(source).toMatch(/deliveries\.statuses/);
    expect(source).not.toMatch(/statusQueued|statusDelivered|Queuing/);
  });
});
