/**
 * Auth shell Pen harness: brand lockup, 448px form column, desktop visual panel.
 * Run: npm run test:ui-harness
 */
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { AuthShell } from "@/components/auth/auth-shell";
import { clerkAuthAppearance } from "@/lib/clerk-auth-appearance";
import { buildClerkAuthLocalization } from "@/lib/clerk-auth-localization";
import messages from "@/messages/fr.json";
import enMessages from "@/messages/en.json";

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

describe("UI harness — auth shell", () => {
  it("renders sign-in shell with Ferry brand, 448px column, and visual panel copy", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <AuthShell variant="sign-in">
          <div data-testid="auth-form-slot">form</div>
        </AuthShell>
      </NextIntlClientProvider>
    );

    const shell = screen.getByTestId("auth-shell-sign-in");
    expect(shell.className).toMatch(/min-h-screen/);

    const brand = screen.getByRole("link", { name: /ferry/i });
    expect(brand.getAttribute("href")).toBe("/");
    expect(brand.className).toMatch(/gap-3/);
    expect(brand.textContent).toMatch(/Ferry/);

    const formSlot = screen.getByTestId("auth-form-slot");
    const formColumn = formSlot.parentElement;
    expect(formColumn?.parentElement?.className).toMatch(/max-w-\[448px\]/);
    expect(formColumn?.parentElement?.className).toMatch(/gap-5/);

    const panel = screen.getByTestId("auth-visual-panel");
    expect(panel.className).toMatch(/hidden/);
    expect(panel.className).toMatch(/lg:block/);
    expect(panel.className).toMatch(/w-\[720px\]/);
    expect(panel.className).toMatch(/bg-muted/);
    expect(panel.textContent).toContain(messages.auth.signIn.panelQuote);
    expect(panel.textContent).toContain(messages.auth.signIn.panelCaption);
    expect(panel.querySelector("img")?.getAttribute("src")).toBe(
      "/auth/sign-in-panel.jpg"
    );
  });

  it("renders sign-up shell with tighter gap and without sign-in caption", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <AuthShell variant="sign-up">
          <div data-testid="auth-form-slot">form</div>
        </AuthShell>
      </NextIntlClientProvider>
    );

    const shell = screen.getByTestId("auth-shell-sign-up");
    const formSlot = screen.getByTestId("auth-form-slot");
    expect(formSlot.parentElement?.parentElement?.className).toMatch(/gap-4/);
    expect(shell.textContent).toContain(messages.auth.signUp.panelQuote);
    expect(shell.textContent).not.toContain(messages.auth.signIn.panelCaption);
    expect(
      screen.getByTestId("auth-visual-panel").querySelector("img")?.getAttribute("src")
    ).toBe("/auth/sign-up-panel.jpg");
  });

  it("keeps FR/EN auth copy symmetric and builds Clerk localization without link slots", () => {
    expect(Object.keys(messages.auth).sort()).toEqual(
      Object.keys(enMessages.auth).sort()
    );
    expect(Object.keys(messages.auth.signIn).sort()).toEqual(
      Object.keys(enMessages.auth.signIn).sort()
    );
    expect(Object.keys(messages.auth.signUp).sort()).toEqual(
      Object.keys(enMessages.auth.signUp).sort()
    );

    const localization = buildClerkAuthLocalization({
      signInTitle: messages.auth.signIn.title,
      signInSubtitle: messages.auth.signIn.subtitle,
      signUpTitle: messages.auth.signUp.title,
      signUpSubtitle: messages.auth.signUp.subtitle,
      emailLabel: messages.auth.signIn.emailLabel,
      passwordLabel: messages.auth.signIn.passwordLabel,
      emailPlaceholder: messages.auth.signIn.emailPlaceholder,
      passwordPlaceholder: messages.auth.signIn.passwordPlaceholder,
      confirmPasswordLabel: messages.auth.signUp.confirmPasswordLabel,
      firstNameLabel: messages.auth.signUp.firstNameLabel,
      lastNameLabel: messages.auth.signUp.lastNameLabel,
      forgotPassword: messages.auth.signIn.forgotPassword,
      signInSubmit: messages.auth.signIn.submit,
      signUpSubmit: messages.auth.signUp.submit,
      noAccountText: messages.auth.signIn.noAccount,
      createAccountLink: messages.auth.signIn.createAccount,
      hasAccountText: messages.auth.signUp.hasAccount,
      signInLink: messages.auth.signUp.signInLink,
      consentLabel: messages.auth.signUp.consent,
      formButtonPrimary: messages.auth.signIn.submit,
    });

    expect(localization.signIn?.start?.title).toBe("Bienvenue");
    expect(localization.signUp?.start?.title).toBe("Créer votre compte");
    expect(localization.formFieldInputPlaceholder__emailAddress).toBe(
      "Votre adresse e-mail"
    );
    expect(localization.formFieldInputPlaceholder__password).toBe(
      "Votre mot de passe"
    );
    expect(enMessages.auth.signIn.emailPlaceholder).toBe(
      "Enter your email address"
    );
    expect(enMessages.auth.signIn.passwordPlaceholder).toBe(
      "Enter your password"
    );
    expect(
      localization.signUp?.legalConsent?.checkbox
        ?.label__termsOfServiceAndPrivacyPolicy
    ).toBe(messages.auth.signUp.consent);
    expect(messages.auth.signUp.consent).not.toMatch(/\{\{/);
    expect(enMessages.auth.signUp.consent).not.toMatch(/\{\{/);

    const appearance = clerkAuthAppearance("sign-in");
    expect(appearance.elements?.card).toMatch(/bg-transparent/);
    expect(appearance.elements?.card).toMatch(/shadow-none/);
    expect(appearance.elements?.card).toMatch(/!w-full/);
    expect(appearance.elements?.card).toMatch(/!p-0/);
    expect(appearance.elements?.card).toMatch(/!max-w-\[448px\]/);
    expect(appearance.elements?.rootBox).toMatch(/!w-full/);
    expect(appearance.elements?.rootBox).toMatch(/!max-w-\[448px\]/);
    expect(appearance.elements?.cardBox).toMatch(/!w-full/);
    expect(appearance.elements?.cardBox).toMatch(/!max-w-\[448px\]/);
    expect(appearance.elements?.formButtonPrimary).toMatch(/h-9/);
    expect(appearance.elements?.formButtonPrimary).toMatch(/rounded-\[10px\]/);
    expect(appearance.elements?.formFieldInput).toMatch(/focus-visible:ring-3/);
    expect(appearance.elements?.socialButtonsRoot).toMatch(/hidden/);
    expect(appearance.elements?.dividerRow).toMatch(/hidden/);
    expect(appearance.elements?.footer).toMatch(/!max-w-\[448px\]/);
    expect(appearance.elements?.footer).toMatch(/!w-full/);
    expect(appearance.elements?.footer).toMatch(/!p-0/);
    expect(appearance.elements?.footer).toMatch(/\[&>\*\]:!px-0/);
    expect(appearance.elements?.footerItem).toMatch(/!max-w-\[448px\]/);
    expect(appearance.elements?.footerItem).toMatch(/!w-full/);
    expect(appearance.elements?.footerItem).toMatch(/text-muted-foreground/);
  });
});
