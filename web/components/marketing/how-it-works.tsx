"use client";

import { useTranslations } from "next-intl";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";

const STEP_KEYS = ["find", "prepare", "send"] as const;

export function HowItWorks() {
  const t = useTranslations("howItWorks");

  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <h2 className="font-heading text-3xl font-medium tracking-tight">
          {t("title")}
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t("subtitle")}</p>
      </Reveal>
      <RevealGroup className="mt-12 grid gap-10 md:grid-cols-3" stagger={0.12}>
        {STEP_KEYS.map((key) => (
          <RevealItem key={key}>
            <div className="h-full">
              <span className="font-heading text-sm text-muted-foreground">
                {t(`steps.${key}.number`)}
              </span>
              <h3 className="mt-2 font-heading text-xl font-medium">
                {t(`steps.${key}.title`)}
              </h3>
              <p className="mt-2 text-muted-foreground">{t(`steps.${key}.body`)}</p>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
