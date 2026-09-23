"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { PassageRule } from "@/components/passage-rule";

const DELIVERY_KEYS = ["kindle", "kobo", "tolino", "usb"] as const;

/**
 * Destination register — supported send channels as an editorial list,
 * not a card grid. Local entrance only; copy readable without motion.
 */
export function Delivered() {
  const t = useTranslations("delivered");
  const prefersReducedMotion = useReducedMotion();
  const enterY = prefersReducedMotion ? 0 : 7;
  const duration = prefersReducedMotion ? 0.01 : 0.28;
  const stagger = prefersReducedMotion ? 0 : 0.05;

  return (
    <section
      id="delivered"
      data-testid="landing-delivered"
      className="border-y border-border"
      aria-labelledby="landing-delivered-title"
    >
      <div className="mx-auto max-w-3xl px-6 py-24">
        <header className="space-y-3">
          <PassageRule />
          <h2
            id="landing-delivered-title"
            className="font-heading text-3xl font-medium tracking-tight text-balance sm:text-4xl"
          >
            {t("title")}
          </h2>
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
            {t("subtitle")}
          </p>
        </header>

        <motion.ol
          className="mt-12 m-0 list-none p-0"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-64px" }}
          transition={{ staggerChildren: stagger }}
        >
          {DELIVERY_KEYS.map((key) => (
            <motion.li
              key={key}
              className="border-t border-border first:border-t-0"
              variants={{
                hidden: { opacity: 1, y: enterY },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration, ease: [0.2, 0, 0, 1] }}
            >
              <div className="flex flex-col gap-2 py-6 sm:flex-row sm:items-baseline sm:justify-between sm:gap-10">
                <h3 className="font-heading text-xl font-medium tracking-tight sm:text-2xl">
                  {t(`items.${key}.name`)}
                </h3>
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground text-pretty sm:text-right sm:text-base">
                  {t(`items.${key}.body`)}
                </p>
              </div>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
