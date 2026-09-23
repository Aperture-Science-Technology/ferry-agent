"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PassageRule } from "@/components/passage-rule";

/**
 * Assistant entry as an editorial aside — same library, another doorway.
 * Keeps #mcp anchor and /docs CTA. No AI badge wall.
 */
export function McpSpotlight() {
  const t = useTranslations("mcpSpotlight");
  const prefersReducedMotion = useReducedMotion();
  const enterY = prefersReducedMotion ? 0 : 7;
  const duration = prefersReducedMotion ? 0.01 : 0.28;

  return (
    <section
      id="mcp"
      data-testid="landing-mcp"
      className="border-y border-border"
      aria-labelledby="landing-mcp-title"
    >
      <div className="mx-auto max-w-6xl px-6 py-24">
        <motion.div
          className="grid gap-10 border-l border-primary/40 pl-6 sm:pl-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-16"
          initial={
            prefersReducedMotion
              ? { opacity: 1, y: 0 }
              : { opacity: 1, y: enterY }
          }
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-64px" }}
          transition={{ duration, ease: [0.2, 0, 0, 1] }}
        >
          <div className="max-w-2xl space-y-3">
            <PassageRule tone="ink" />
            <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
              {t("eyebrow")}
            </p>
            <h2
              id="landing-mcp-title"
              className="font-heading text-3xl font-medium tracking-tight text-balance sm:text-4xl"
            >
              {t("title")}
            </h2>
            <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
              {t("body")}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
            <Button
              size="lg"
              className="transition-colors duration-125"
              render={<Link href="/docs">{t("cta")}</Link>}
            />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground text-pretty">
              {t("aside")}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
