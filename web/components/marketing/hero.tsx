"use client";

import { motion, useReducedMotion } from "motion/react";
import { Show, SignInButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-logo";
import { PassageRule } from "@/components/passage-rule";

export function Hero() {
  const t = useTranslations("hero");
  const prefersReducedMotion = useReducedMotion();
  const enterY = prefersReducedMotion ? 0 : 14;
  const duration = prefersReducedMotion ? 0.01 : 0.55;
  const delayStep = prefersReducedMotion ? 0 : 0.08;

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,oklch(0.94_0.02_70)_0%,transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-px bg-border"
      />

      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 pt-20 pb-24 text-center sm:pt-28">
        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.01 : 0.45 }}
          className="mb-8 flex flex-col items-center gap-4"
        >
          <BrandMark className="size-10 text-primary" />
          <PassageRule />
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            {t("badge")}
          </p>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: enterY }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration, ease: "easeOut" }}
          className="font-heading text-5xl leading-[1.05] font-medium tracking-tight text-balance sm:text-6xl md:text-7xl"
        >
          <span className="block text-foreground">{t("titleBefore")}</span>
          <span className="mt-2 block text-primary">{t("titleHighlight")}</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: enterY }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration, ease: "easeOut", delay: delayStep }}
          className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground"
        >
          {t("subtitle")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: enterY }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration, ease: "easeOut", delay: delayStep * 2 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Show when="signed-out">
            <SignInButton>
              <Button size="lg">{t("ctaDashboard")}</Button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Button
              size="lg"
              render={<Link href="/app/bibliotheque">{t("ctaDashboard")}</Link>}
            />
          </Show>
          <Button
            variant="outline"
            size="lg"
            render={<Link href="/#how-it-works">{t("ctaHow")}</Link>}
          />
        </motion.div>
      </div>
    </section>
  );
}
