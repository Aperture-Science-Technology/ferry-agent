"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BrandMark } from "@/components/brand-logo";
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  variant: "sign-in" | "sign-up";
  children: React.ReactNode;
};

/**
 * Auth page shell — brand + 448px form column, optional visual panel.
 */
export function AuthShell({ variant, children }: AuthShellProps) {
  const t = useTranslations("auth");
  const formGap = variant === "sign-in" ? "gap-5" : "gap-4";
  const panelKey = variant === "sign-in" ? "signIn" : "signUp";

  return (
    <div
      data-testid={`auth-shell-${variant}`}
      className="flex min-h-screen w-full bg-background"
    >
      <div className="flex min-h-screen w-full flex-1 flex-col items-center justify-center px-6 py-12">
        <div
          className={cn(
            "flex w-full max-w-[448px] flex-col items-start",
            formGap
          )}
        >
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <BrandMark className="size-7" />
            <span className="text-lg font-bold tracking-tight">
              {t("brandName")}
            </span>
          </Link>

          <div className={cn("flex w-full flex-col", formGap)}>{children}</div>
        </div>
      </div>

      <AuthVisualPanel
        imageSrc={
          variant === "sign-in"
            ? "/auth/sign-in-panel.jpg"
            : "/auth/sign-up-panel.jpg"
        }
        imageAlt={t(`${panelKey}.panelAlt`)}
        quote={t(`${panelKey}.panelQuote`)}
        caption={
          variant === "sign-in" ? t("signIn.panelCaption") : undefined
        }
      />
    </div>
  );
}
