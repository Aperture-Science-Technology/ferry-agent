"use client";

import { useTranslations } from "next-intl";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { PassageRule } from "@/components/passage-rule";

const VALUE_KEYS = ["cloudFirst", "legal", "gatewayOptional"] as const;

export function ValueProps() {
  const t = useTranslations("valueProps");

  return (
    <section className="border-y border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <div className="mb-12 space-y-3">
            <PassageRule />
            <p className="text-sm font-medium tracking-[0.14em] text-muted-foreground uppercase">
              {t("eyebrow")}
            </p>
          </div>
        </Reveal>
        <RevealGroup className="grid gap-12 md:grid-cols-3 md:gap-10">
          {VALUE_KEYS.map((key, index) => (
            <RevealItem key={key}>
              <article className="h-full border-t border-border pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-6 md:first:border-l-0 md:first:pl-0">
                <span className="font-heading text-xs tracking-[0.14em] text-primary uppercase">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="mt-3 font-heading text-2xl font-medium tracking-tight text-balance">
                  {t(`items.${key}.title`)}
                </h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  {t(`items.${key}.body`)}
                </p>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
