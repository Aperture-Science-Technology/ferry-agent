/**
 * Smoke render: real Button + real globals.css.
 * Run: npm run test:ui-harness
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

const globalsCss = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../app/globals.css"),
  "utf8"
);

describe("UI harness — Button", () => {
  it("renders the real Button with project style classes and stylesheet tokens", () => {
    render(<Button type="button">Envoyer</Button>);

    const button = screen.getByRole("button", { name: "Envoyer" });
    expect(button.getAttribute("data-slot")).toBe("button");
    expect(button.className).toContain("bg-primary");
    expect(button.className).toContain("text-primary-foreground");

    const stylesheetText = Array.from(document.querySelectorAll("style"))
      .map((node) => node.textContent ?? "")
      .join("\n");
    expect(stylesheetText).toContain("--primary");
    expect(stylesheetText).toContain("--primary: #e5e5e5");
    expect(stylesheetText).toContain("--primary-foreground: #171717");
  });

  it("locks --destructive to solid red in both theme blocks", () => {
    const matches = globalsCss.match(/--destructive:\s*#ff6467;/g) ?? [];
    expect(matches).toHaveLength(2);
    expect(globalsCss).toContain("--destructive-foreground: #fafafa;");
    expect(globalsCss).not.toMatch(/--destructive:\s*#ef4444;/);
  });

  it("keeps ghost transparent at rest with accent only on hover", () => {
    render(<Button type="button" variant="ghost">Ghost</Button>);

    const className = screen.getByRole("button", { name: "Ghost" }).className;
    expect(
      className.includes("bg-transparent") &&
        !/(?:^|\s)bg-accent(?:\s|$)/.test(className) &&
        !/(?:^|\s)bg-secondary(?:\s|$)/.test(className) &&
        className.includes("hover:bg-accent")
    ).toBe(true);
  });
});
