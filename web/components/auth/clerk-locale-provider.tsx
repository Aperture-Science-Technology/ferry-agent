"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ClerkProvider } from "@clerk/nextjs";
import {
  buildClerkAuthLocalization,
  type AuthCopy,
} from "@/lib/clerk-auth-localization";

type ClerkLocaleProviderProps = {
  authCopy: Omit<AuthCopy, "formButtonPrimary">;
  children: React.ReactNode;
};

/**
 * Path-aware Clerk localization so sign-in and sign-up primary CTAs differ.
 */
export function ClerkLocaleProvider({
  authCopy,
  children,
}: ClerkLocaleProviderProps) {
  const pathname = usePathname();
  const onSignUp = pathname.includes("/sign-up");
  const localization = useMemo(
    () =>
      buildClerkAuthLocalization({
        ...authCopy,
        formButtonPrimary: onSignUp
          ? authCopy.signUpSubmit
          : authCopy.signInSubmit,
      }),
    [authCopy, onSignUp]
  );

  return (
    <ClerkProvider dynamic localization={localization}>
      {children}
    </ClerkProvider>
  );
}
