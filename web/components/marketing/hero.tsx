"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PassageRule } from "@/components/passage-rule";
import { PassageScene } from "@/components/marketing/passage-scene";

/**
 * Public landing hero — centered editorial promise + monumental product scene.
 * Title, subtitle and primary CTA are plain HTML from first paint (no entrance hide).
 * Scene motion is local to PassageScene and respects prefers-reduced-motion.
 */
export function Hero() {
  const t = useTranslations("hero");

  return (
    <section
      data-testid="landing-hero"
      className="relative overflow-hidden border-b border-border"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,oklch(0.94_0.02_70)_0%,transparent_58%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70%] bg-[linear-gradient(180deg,oklch(0.97_0.01_75)_0%,transparent_100%)]"
      />

      <div className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-16 text-center sm:pt-20 lg:pt-24">
        <PassageRule className="mb-5" />
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          {t("badge")}
        </p>

        <h1 className="mt-4 font-heading text-4xl leading-[1.08] font-medium tracking-tight text-balance sm:text-5xl lg:text-6xl">
          <span className="block text-foreground">{t("titleBefore")}</span>
          <span className="mt-2 block text-primary">{t("titleHighlight")}</span>
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {t("subtitle")}
        </p>

        <div className="mt-8 flex flex-col items-center gap-4 sm:mt-9">
          <Show when="signed-out">
            <SignInButton>
              <Button size="lg" className="transition-colors duration-125">
                {t("ctaDashboard")}
              </Button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Button
              size="lg"
              className="transition-colors duration-125"
              render={
                <Link href="/app/bibliotheque">{t("ctaDashboard")}</Link>
              }
            />
          </Show>
          <Link
            href="/#how-it-works"
            className="text-sm text-muted-foreground underline-offset-4 transition-colors duration-125 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("ctaHow")}
          </Link>
        </div>
      </div>

      {/* Monumental scene under copy — partially clipped like a product stage */}
      <div className="relative mx-auto mt-10 w-full max-w-[88rem] px-3 sm:mt-12 sm:px-5 lg:mt-14 lg:px-8">
        <PassageScene />
      </div>
    </section>
  );
}
