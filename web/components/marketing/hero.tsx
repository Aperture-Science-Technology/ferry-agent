"use client";

import { useState } from "react";
import Image from "next/image";
import { Show } from "@clerk/nextjs";
import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Public landing hero — Pen LLhzT Hero (two-tone display, CTAs, demo media).
 * Title, subtitle and CTAs are plain HTML from first paint (no entrance hide).
 */
export function Hero() {
  const t = useTranslations("hero");
  const tLanding = useTranslations("landing.hero");
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <section
      data-testid="landing-hero"
      className="relative overflow-hidden"
    >
      <div className="relative mx-auto flex w-full max-w-[1200px] flex-col items-center px-6 pt-16 text-center sm:pt-[112px]">
        <h1 className="relative font-heading text-[36px] leading-[39.6px] font-medium tracking-[-0.9px] text-balance sm:text-[72px] sm:leading-[1.1] sm:tracking-[-1.8px]">
          <span className="block text-foreground">{t("titleBefore")}</span>
          <span className="block text-muted-foreground">
            {t("titleHighlight")}
          </span>
        </h1>

        <p className="relative mt-6 max-w-[560px] text-xl leading-[1.2] text-foreground">
          {t("subtitle")}
        </p>

        <div className="relative mt-6 flex flex-col items-center gap-3">
          <div className="flex w-full flex-col items-center gap-3 min-[321px]:w-auto min-[321px]:flex-row">
            <Show when="signed-out">
              <Button
                size="lg"
                className="h-10 rounded-xl px-6 transition-colors duration-150 max-[320px]:w-full"
                render={
                  <Link href="/sign-in">{tLanding("ctaPrimary")}</Link>
                }
              />
            </Show>
            <Show when="signed-in">
              <Button
                size="lg"
                className="h-10 rounded-xl px-6 transition-colors duration-150 max-[320px]:w-full"
                render={
                  <Link href="/app/bibliotheque">{tLanding("ctaPrimary")}</Link>
                }
              />
            </Show>
            <Button
              variant="outline"
              size="lg"
              className="h-10 rounded-xl px-6 transition-colors duration-150 max-[320px]:w-full"
              render={
                <Link href="/#how-it-works">{tLanding("ctaSecondary")}</Link>
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">{tLanding("builtBy")}</p>
        </div>

        <div className="relative mt-10 w-full">
          <div
            data-testid="landing-hero-media"
            className="relative aspect-[3/2] w-full overflow-hidden rounded-xl border border-white/15"
          >
            <Image
              src="/landing/hero-demo.jpg"
              alt=""
              fill
              priority
              sizes="(max-width: 1152px) 100vw, 1152px"
              className="object-cover"
            />
            <div aria-hidden className="absolute inset-0 bg-[#1D4ED8]/35" />
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.45)_0%,rgba(37,99,235,0)_72%)]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-[65%] to-background"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3.5">
              <button
                type="button"
                className="flex size-[72px] items-center justify-center rounded-full border border-border bg-white/20 text-white transition-colors duration-150 hover:bg-white/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                aria-label={tLanding("demoTitle")}
                onClick={() => setDemoOpen(true)}
              >
                <Play className="size-7 fill-current" aria-hidden />
              </button>
              <p className="text-sm font-medium text-white">
                {tLanding("demoTitle")}
              </p>
              <p className="max-w-sm px-4 text-[13px] text-white">
                {tLanding("demoBody")}
              </p>
            </div>
          </div>
          <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{tLanding("demoTitle")}</DialogTitle>
                <DialogDescription>{tLanding("demoBody")}</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </section>
  );
}
