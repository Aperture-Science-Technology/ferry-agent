"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";

const STEP_KEYS = ["pair", "search", "deliver"] as const;

export function HowItWorks() {
  const t = useTranslations("howItWorks");

  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <h2 className="font-heading text-3xl font-medium tracking-tight">
          {t("title")}
        </h2>
      </Reveal>
      <RevealGroup className="mt-10 grid gap-6 md:grid-cols-3" stagger={0.12}>
        {STEP_KEYS.map((key) => (
          <RevealItem key={key}>
            <Card className="h-full border-border/60 bg-card/40 transition hover:-translate-y-0.5 hover:shadow-lg">
              <CardContent className="pt-2">
                <span className="font-heading text-sm text-muted-foreground">
                  {t(`steps.${key}.number`)}
                </span>
                <h3 className="mt-2 font-heading text-xl font-medium">
                  {t(`steps.${key}.title`)}
                </h3>
                <p className="mt-2 text-muted-foreground">{t(`steps.${key}.body`)}</p>
              </CardContent>
            </Card>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
