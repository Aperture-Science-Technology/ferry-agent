"use client";

import { motion, useReducedMotion } from "motion/react";
import { Show, SignInButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/status-dot";

export function Hero() {
  const t = useTranslations("hero");
  const prefersReducedMotion = useReducedMotion();
  const enterY = prefersReducedMotion ? 0 : 16;
  const duration = prefersReducedMotion ? 0.01 : 0.6;
  const delayStep = prefersReducedMotion ? 0 : 0.1;

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 flex justify-center">
        <div className="h-96 w-[36rem] rounded-full bg-gradient-to-r from-teal-500/20 via-sky-500/10 to-transparent blur-3xl" />
      </div>

      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 pt-24 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.01 : 0.5 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 text-xs text-muted-foreground"
        >
          <StatusDot />
          {t("badge")}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: enterY }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration, ease: "easeOut" }}
          className="font-heading text-5xl leading-[1.05] font-medium tracking-tight text-balance sm:text-6xl"
        >
          {t("titleBefore")}{" "}
          <span className="bg-gradient-to-r from-teal-300 via-sky-300 to-teal-200 bg-clip-text text-transparent">
            {t("titleHighlight")}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: enterY }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration, ease: "easeOut", delay: delayStep }}
          className="mt-6 max-w-xl text-lg text-muted-foreground"
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
              <Button
                size="lg"
                className="transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                {t("ctaDashboard")}
              </Button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Button
              size="lg"
              className="transition hover:-translate-y-0.5 hover:shadow-lg"
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
