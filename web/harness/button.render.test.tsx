/**
 * Smoke render: real Button + real globals.css.
 * Run: npm run test:ui-harness
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

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
    expect(stylesheetText).toMatch(/#9a4825|oklch\(/);
  });
});
