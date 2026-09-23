/**
 * Landing hero composition harness: centered editorial layout, no scene card,
 * first-paint copy, secondary text link, fixed mobile SVG encoding.
 * Run: npm run test:ui-harness
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { Hero } from "@/components/marketing/hero";
import messages from "@/messages/fr.json";

vi.mock("@clerk/nextjs", () => ({
  Show: ({
    when,
    children,
  }: {
    when: "signed-in" | "signed-out";
    children: React.ReactNode;
  }) => (when === "signed-out" ? <>{children}</> : null),
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UserButton: () => null,
}));

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
      figure: (
        props: React.HTMLAttributes<HTMLElement> & {
          children?: React.ReactNode;
        }
      ) => React.createElement("figure", props),
      div: passthrough,
      span: (
        props: React.HTMLAttributes<HTMLElement> & {
          children?: React.ReactNode;
        }
      ) => React.createElement("span", props),
    },
    useReducedMotion: () => false,
  };
});

const landingDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/illustrations/landing"
);

describe("UI harness — landing hero editorial composition", () => {
  it("renders a centered promise with first-paint title and primary CTA, without a scene card", () => {
    const { container } = render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <Hero />
      </NextIntlClientProvider>
    );

    const hero = screen.getByTestId("landing-hero");
    expect(hero.className).toContain("overflow-hidden");

    const title = screen.getByRole("heading", { level: 1 });
    expect(title.textContent).toMatch(/bibliothèque en ligne/i);
    expect(title.textContent).toMatch(/liseuse/i);

    const cta = screen.getByRole("button", {
      name: /ouvrir ma bibliothèque/i,
    });
    expect(cta).toBeTruthy();

    const how = screen.getByRole("link", { name: /voir les étapes/i });
    expect(how.getAttribute("href")).toBe("/#how-it-works");
    expect(how.className).not.toMatch(/border|bg-primary|variant/);

    const scene = screen.getByTestId("landing-passage-scene");
    expect(scene.className).not.toMatch(/rounded-2xl|border-border|bg-card/);
    expect(scene.querySelector("[class*='rounded-2xl']")).toBeNull();
    expect(scene.querySelector("[class*='border-border']")).toBeNull();
    expect(scene.querySelector("[class*='bg-card']")).toBeNull();

    // No competing outline button next to the primary CTA
    expect(
      container.querySelectorAll('[data-slot="button"]').length
    ).toBe(1);

    expect(screen.getByTestId("landing-passage-desktop")).toBeTruthy();
    expect(screen.getByTestId("landing-passage-mobile")).toBeTruthy();
    expect(screen.getAllByTestId("landing-passage-travel").length).toBe(2);
  });

  it("keeps the mobile passage SVG in pure ASCII (no broken encoding)", () => {
    const bytes = readFileSync(path.join(landingDir, "passage-mobile.svg"));
    const nonAscii = [...bytes].filter((b) => b > 127);
    expect(nonAscii).toEqual([]);
    const text = bytes.toString("utf8");
    expect(text).toContain("library to book");
    expect(text).not.toMatch(/library.book/);
  });

  it("ships a wide desktop scene and a distinct near-square mobile scene", () => {
    const desktop = readFileSync(
      path.join(landingDir, "passage-desktop.svg"),
      "utf8"
    );
    const mobile = readFileSync(
      path.join(landingDir, "passage-mobile.svg"),
      "utf8"
    );
    expect(desktop).toMatch(/viewBox="0 0 800 500"/);
    expect(mobile).toMatch(/viewBox="0 0 400 400"/);
    // Shared demo-cover mark present in both compositions
    expect(desktop).toContain("#A36B3A");
    expect(mobile).toContain("#A36B3A");
  });
});
