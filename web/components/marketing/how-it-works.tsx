"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { PassageRule } from "@/components/passage-rule";

const STEP_KEYS = ["add", "choose", "send"] as const;

/**
 * Three-step landing section with local entrance motion only.
 * Does not use shared Reveal (16px / longer timings) — pilot-specific bounds.
 */
export function HowItWorks() {
  const t = useTranslations("howItWorks");
  const prefersReducedMotion = useReducedMotion();
  const enterY = prefersReducedMotion ? 0 : 7;
  const duration = prefersReducedMotion ? 0.01 : 0.28;
  const stagger = prefersReducedMotion ? 0 : 0.05;

  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24">
      <div className="space-y-3">
        <PassageRule />
        <h2 className="font-heading text-3xl font-medium tracking-tight sm:text-4xl">
          {t("title")}
        </h2>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <motion.ol
        className="mt-14 grid list-none gap-10 p-0 md:grid-cols-3"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-64px" }}
        transition={{ staggerChildren: stagger }}
      >
        {STEP_KEYS.map((key) => (
          <motion.li
            key={key}
            className="relative h-full space-y-3"
            variants={{
              // Keep copy fully readable before/without motion; only nudge vertically.
              hidden: { opacity: 1, y: enterY },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ duration, ease: [0.2, 0, 0, 1] }}
          >
            <span className="font-heading text-4xl font-medium text-primary/25">
              {t(`steps.${key}.number`)}
            </span>
            <h3 className="font-heading text-xl font-medium">
              {t(`steps.${key}.title`)}
            </h3>
            <p className="leading-relaxed text-muted-foreground">
              {t(`steps.${key}.body`)}
            </p>
          </motion.li>
        ))}
      </motion.ol>
    </section>
  );
}
