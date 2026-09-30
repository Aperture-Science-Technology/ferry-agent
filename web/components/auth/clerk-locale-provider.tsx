"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ClerkProvider } from "@clerk/nextjs";
import { enUS, frFR } from "@clerk/localizations";
import {
  buildClerkAuthLocalization,
  type AuthCopy,
} from "@/lib/clerk-auth-localization";

type ClerkLocaleProviderProps = {
  locale: "fr" | "en";
  authCopy: Omit<AuthCopy, "formButtonPrimary">;
  children: React.ReactNode;
};

/**
 * Path-aware Clerk localization so sign-in and sign-up primary CTAs differ.
 * Locale pack (frFR/enUS) covers all Clerk screens; authCopy overrides Ferry titles.
 */
export function ClerkLocaleProvider({
  locale,
  authCopy,
  children,
}: ClerkLocaleProviderProps) {
  const pathname = usePathname();
  const onSignUp = pathname.includes("/sign-up");
  const localization = useMemo(
    () =>
      buildClerkAuthLocalization(
        {
          ...authCopy,
          formButtonPrimary: onSignUp
            ? authCopy.signUpSubmit
            : authCopy.signInSubmit,
        },
        locale === "fr" ? frFR : enUS
      ),
    [authCopy, onSignUp, locale]
  );

  return (
    <ClerkProvider dynamic localization={localization}>
      {children}
    </ClerkProvider>
  );
}
