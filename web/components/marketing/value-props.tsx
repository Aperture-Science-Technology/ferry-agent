"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { CloudGatewayIllustration } from "@/components/illustrations";
import { PassageRule } from "@/components/passage-rule";

const VALUE_KEYS = ["cloudFirst", "legal", "gatewayOptional"] as const;

/**
 * Editorial value chapter: paper hierarchy + cloud/Gateway transfer diagram.
 * Local entrance only — copy stays readable without animation.
 */
export function ValueProps() {
  const t = useTranslations("valueProps");
  const prefersReducedMotion = useReducedMotion();
  const enterY = prefersReducedMotion ? 0 : 7;
  const duration = prefersReducedMotion ? 0.01 : 0.28;
  const stagger = prefersReducedMotion ? 0 : 0.05;

  return (
    <section
      data-testid="landing-value-props"
      className="border-y border-border"
      aria-labelledby="landing-value-props-title"
    >
      <div className="mx-auto max-w-6xl px-6 py-24">
        <header className="max-w-2xl space-y-3">
          <PassageRule />
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            {t("eyebrow")}
          </p>
          <h2
            id="landing-value-props-title"
            className="font-heading text-3xl font-medium tracking-tight text-balance sm:text-4xl"
          >
            {t("title")}
          </h2>
          <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
            {t("lead")}
          </p>
        </header>

        <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,13.5rem)_minmax(0,1fr)] lg:items-start lg:gap-16">
          <figure
            data-testid="landing-value-transfer"
            className="mx-auto w-full max-w-[13.5rem] lg:mx-0"
            aria-labelledby="landing-value-transfer-caption"
          >
            <CloudGatewayIllustration className="mx-0 w-full max-w-[200px]" />
            <ul className="mt-4 grid grid-cols-2 gap-2 text-center text-[0.7rem] leading-snug text-muted-foreground sm:text-xs">
              <li>{t("sceneCloud")}</li>
              <li>{t("sceneGateway")}</li>
            </ul>
            <figcaption
              id="landing-value-transfer-caption"
              className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty"
            >
              {t("sceneCaption")}
            </figcaption>
          </figure>

          <motion.ol
            className="m-0 list-none space-y-0 p-0"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-64px" }}
            transition={{ staggerChildren: stagger }}
          >
            {VALUE_KEYS.map((key, index) => (
              <motion.li
                key={key}
                className="border-t border-border py-8 first:border-t-0 first:pt-0 last:pb-0"
                variants={{
                  hidden: { opacity: 1, y: enterY },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration, ease: [0.2, 0, 0, 1] }}
              >
                <div className="flex gap-5 sm:gap-8">
                  <span
                    aria-hidden
                    className="font-heading text-3xl font-medium text-primary/25 sm:text-4xl"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 space-y-2 pt-1">
                    <h3 className="font-heading text-xl font-medium tracking-tight text-balance sm:text-2xl">
                      {t(`items.${key}.title`)}
                    </h3>
                    <p className="leading-relaxed text-muted-foreground text-pretty">
                      {t(`items.${key}.body`)}
                    </p>
                  </div>
                </div>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </div>
    </section>
  );
}
