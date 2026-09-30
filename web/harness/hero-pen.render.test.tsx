/**
 * Landing hero Pen LLhzT composition harness: single h1, 72/500 display,
 * i18n CTAs, 3:2 demo media overlay, no inline styles.
 * Run: npm run test:ui-harness
 */
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

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    const { alt, src, className } = props;
    return <img alt={alt ?? ""} src={typeof src === "string" ? src : ""} className={className} />;
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
      span: (
        props: React.HTMLAttributes<HTMLElement> & {
          children?: React.ReactNode;
        }
      ) => React.createElement("span", props),
    },
    useReducedMotion: () => false,
  };
});

describe("UI harness — landing hero Pen LLhzT composition", () => {
  it("renders a single two-tone h1, i18n CTAs, and coming-soon media", () => {
    const { container } = render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <Hero />
      </NextIntlClientProvider>
    );

    const titles = screen.getAllByRole("heading", { level: 1 });
    expect(titles).toHaveLength(1);

    const title = titles[0];
    expect(title.className).toMatch(/text-\[72px\]/);
    expect(title.className).toMatch(/font-medium/);
    expect(title.textContent).toMatch(/Ferry Agent\./);
    expect(title.textContent).toMatch(/Trouver, préparer, envoyer\./);

    const line1 = title.querySelector(".text-foreground");
    const line2 = title.querySelector(".text-muted-foreground");
    expect(line1?.textContent).toMatch(/Ferry Agent\./);
    expect(line2?.textContent).toMatch(/Trouver, préparer, envoyer\./);

    expect(screen.queryByText(/en ligne, pour votre liseuse/i)).toBeNull();
    expect(
      container.querySelector(
        '[class*="radial-gradient"][class*="var(--foreground)"]'
      )
    ).toBeNull();

    expect(
      screen.getByRole("link", { name: /ouvrir l'espace/i }).getAttribute("href")
    ).toBe("/sign-in");
    const how = screen.getByRole("link", { name: /comment ça marche/i });
    expect(how.getAttribute("href")).toBe("/#how-it-works");

    const media = screen.getByTestId("landing-hero-media");
    expect(media.className).toMatch(/aspect-\[3\/2\]/);
    expect(media.className).toMatch(/border-white\/15/);

    const mediaLayers = media.querySelectorAll(":scope > [aria-hidden]");
    expect(mediaLayers.length).toBeGreaterThanOrEqual(3);
    const layerClasses = [...mediaLayers].map((el) => el.className);
    expect(layerClasses.some((c) => c.includes("bg-[#1D4ED8]/35"))).toBe(true);
    expect(
      layerClasses.some((c) =>
        c.includes("radial-gradient(ellipse_at_center,rgba(37,99,235")
      )
    ).toBe(true);
    expect(
      layerClasses.some(
        (c) =>
          c.includes("bg-gradient-to-b") &&
          c.includes("via-[65%]") &&
          c.includes("to-background")
      )
    ).toBe(true);
    expect(layerClasses.some((c) => c.includes("bg-background/60"))).toBe(
      false
    );

    const demoTitle = screen.getByText(/démo bientôt disponible/i);
    expect(demoTitle).toBeTruthy();
    expect(demoTitle.className).toMatch(/(?:^|\s)text-white(?:\s|$)/);
    const demoBody = screen.getByText(/un aperçu court de ferry/i);
    expect(demoBody.className).toMatch(/(?:^|\s)text-white(?:\s|$)/);
    expect(demoBody.className).not.toMatch(/text-white\/80/);
    const play = screen.getByRole("button", {
      name: /démo bientôt disponible/i,
    });
    expect(play).toBeTruthy();
    expect(play.className).toMatch(/border-border/);
    expect(play.className).toMatch(/text-white/);

    expect(container.innerHTML).not.toMatch(/style=\{\{/);
    expect(container.querySelector("[style]")).toBeNull();
  });
});
