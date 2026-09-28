import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ClerkLocaleProvider } from "@/components/auth/clerk-locale-provider";
import { routing } from "@/i18n/routing";

const interTight = Inter_Tight({
  variable: "--font-primary",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  display: "swap",
  style: "normal",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const tAuth = await getTranslations("auth");
  const authCopy = {
    signInTitle: tAuth("signIn.title"),
    signInSubtitle: tAuth("signIn.subtitle"),
    signUpTitle: tAuth("signUp.title"),
    signUpSubtitle: tAuth("signUp.subtitle"),
    emailLabel: tAuth("signIn.emailLabel"),
    passwordLabel: tAuth("signIn.passwordLabel"),
    emailPlaceholder: tAuth("signIn.emailPlaceholder"),
    passwordPlaceholder: tAuth("signIn.passwordPlaceholder"),
    confirmPasswordLabel: tAuth("signUp.confirmPasswordLabel"),
    firstNameLabel: tAuth("signUp.firstNameLabel"),
    lastNameLabel: tAuth("signUp.lastNameLabel"),
    forgotPassword: tAuth("signIn.forgotPassword"),
    signInSubmit: tAuth("signIn.submit"),
    signUpSubmit: tAuth("signUp.submit"),
    noAccountText: tAuth("signIn.noAccount"),
    createAccountLink: tAuth("signIn.createAccount"),
    hasAccountText: tAuth("signUp.hasAccount"),
    signInLink: tAuth("signUp.signInLink"),
    consentLabel: tAuth("signUp.consent"),
  };

  return (
    <html
      lang={locale}
      className={`${interTight.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground">
        <ClerkLocaleProvider authCopy={authCopy}>
          <NextIntlClientProvider messages={messages}>
            <TooltipProvider>
              {children}
              <Toaster richColors position="bottom-right" />
            </TooltipProvider>
          </NextIntlClientProvider>
        </ClerkLocaleProvider>
      </body>
    </html>
  );
}
