"use client";

import { useTranslations } from "next-intl";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { PassageRule } from "@/components/passage-rule";

const STEP_KEYS = ["find", "prepare", "send"] as const;

export function HowItWorks() {
  const t = useTranslations("howItWorks");

  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <div className="space-y-3">
          <PassageRule />
          <h2 className="font-heading text-3xl font-medium tracking-tight sm:text-4xl">
            {t("title")}
          </h2>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </Reveal>
      <RevealGroup className="mt-14 grid gap-10 md:grid-cols-3" stagger={0.12}>
        {STEP_KEYS.map((key) => (
          <RevealItem key={key}>
            <div className="relative h-full space-y-3">
              <span className="font-heading text-4xl font-medium text-primary/25">
                {t(`steps.${key}.number`)}
              </span>
              <h3 className="font-heading text-xl font-medium">
                {t(`steps.${key}.title`)}
              </h3>
              <p className="leading-relaxed text-muted-foreground">
                {t(`steps.${key}.body`)}
              </p>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
