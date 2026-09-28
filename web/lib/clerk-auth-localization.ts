import type { LocalizationResource } from "@clerk/shared/types";

export type AuthCopy = {
  signInTitle: string;
  signInSubtitle: string;
  signUpTitle: string;
  signUpSubtitle: string;
  emailLabel: string;
  passwordLabel: string;
  confirmPasswordLabel: string;
  firstNameLabel: string;
  lastNameLabel: string;
  forgotPassword: string;
  signInSubmit: string;
  signUpSubmit: string;
  noAccountText: string;
  createAccountLink: string;
  hasAccountText: string;
  signInLink: string;
  /** Plain consent copy — no ToS/Privacy routes exist yet. */
  consentLabel: string;
  /** Primary CTA label for the current auth surface. */
  formButtonPrimary: string;
};

/**
 * Clerk localization overrides sourced from next-intl auth messages.
 * Consent uses a plain string (no link slots) until legal pages exist.
 */
export function buildClerkAuthLocalization(
  copy: AuthCopy
): LocalizationResource {
  return {
    formFieldLabel__emailAddress: copy.emailLabel,
    formFieldLabel__password: copy.passwordLabel,
    formFieldLabel__confirmPassword: copy.confirmPasswordLabel,
    formFieldLabel__firstName: copy.firstNameLabel,
    formFieldLabel__lastName: copy.lastNameLabel,
    formFieldAction__forgotPassword: copy.forgotPassword,
    formButtonPrimary: copy.formButtonPrimary,
    signIn: {
      start: {
        title: copy.signInTitle,
        subtitle: copy.signInSubtitle,
        actionText: copy.noAccountText,
        actionLink: copy.createAccountLink,
      },
      password: {
        title: copy.signInTitle,
        subtitle: copy.signInSubtitle,
      },
    },
    signUp: {
      start: {
        title: copy.signUpTitle,
        subtitle: copy.signUpSubtitle,
        actionText: copy.hasAccountText,
        actionLink: copy.signInLink,
      },
      legalConsent: {
        checkbox: {
          // Plain text on purpose: ToS / privacy routes are not shipped yet.
          label__termsOfServiceAndPrivacyPolicy: copy.consentLabel as never,
          label__onlyPrivacyPolicy: copy.consentLabel as never,
          label__onlyTermsOfService: copy.consentLabel as never,
        },
      },
    },
  };
}
