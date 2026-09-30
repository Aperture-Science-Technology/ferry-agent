/**
 * Invitation-only sign-up panel harness + route source guard.
 * Run: npm run test:ui-harness
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { InvitationOnlyPanel } from "@/components/auth/invitation-only-panel";
import messages from "@/messages/fr.json";
import enMessages from "@/messages/en.json";

const SIGN_UP_PAGE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../app/[locale]/sign-up/[[...sign-up]]/page.tsx"
);

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

describe("UI harness — auth invitation-only", () => {
  it("renders FR invitation panel with sign-in and docs links, no mailto", () => {
    const { container } = render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <InvitationOnlyPanel />
      </NextIntlClientProvider>
    );

    const panel = screen.getByTestId("invitation-only-panel");
    expect(panel.textContent).toContain(messages.auth.signUpInvite.title);
    expect(panel.textContent).toContain(messages.auth.signUpInvite.body);
    expect(panel.textContent).toContain(messages.auth.signUpInvite.hint);

    const signIn = screen.getByRole("link", {
      name: messages.auth.signUpInvite.ctaSignIn,
    });
    expect(signIn.getAttribute("href")).toBe("/sign-in");

    const docs = screen.getByRole("link", {
      name: messages.auth.signUpInvite.ctaDocs,
    });
    expect(docs.getAttribute("href")).toBe("/docs");

    expect(container.innerHTML).not.toMatch(/mailto:/);
  });

  it("renders EN invitation panel with matching structure", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <InvitationOnlyPanel />
      </NextIntlClientProvider>
    );

    const panel = screen.getByTestId("invitation-only-panel");
    expect(panel.textContent).toContain(enMessages.auth.signUpInvite.title);
    expect(panel.textContent).toContain(enMessages.auth.signUpInvite.body);
    expect(panel.textContent).toContain(enMessages.auth.signUpInvite.hint);

    expect(
      screen.getByRole("link", { name: enMessages.auth.signUpInvite.ctaSignIn })
        .getAttribute("href")
    ).toBe("/sign-in");
    expect(
      screen.getByRole("link", { name: enMessages.auth.signUpInvite.ctaDocs })
        .getAttribute("href")
    ).toBe("/docs");
    expect(container.innerHTML).not.toMatch(/mailto:/);
  });

  it("keeps sign-up route free of Clerk SignUp and wired to InvitationOnlyPanel", () => {
    const source = readFileSync(SIGN_UP_PAGE_PATH, "utf8");
    expect(source).not.toMatch(/from ["']@clerk\/nextjs["']/);
    expect(source).not.toMatch(/<SignUp/);
    expect(source).toMatch(/InvitationOnlyPanel/);
  });
});
