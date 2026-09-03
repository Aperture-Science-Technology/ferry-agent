"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";

const VALUE_KEYS = ["selfHosted", "legal", "detached"] as const;

export function ValueProps() {
  const t = useTranslations("valueProps");

  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <p className="mb-12 text-sm font-medium tracking-wide text-muted-foreground uppercase">
          {t("eyebrow")}
        </p>
      </Reveal>
      <RevealGroup className="grid gap-6 md:grid-cols-3">
        {VALUE_KEYS.map((key) => (
          <RevealItem key={key}>
            <Card className="h-full border-border/60 bg-card/40 transition hover:-translate-y-0.5 hover:shadow-lg">
              <CardContent className="pt-2">
                <h2 className="font-heading text-2xl font-medium tracking-tight text-balance">
                  {t(`items.${key}.title`)}
                </h2>
                <p className="mt-3 text-muted-foreground">{t(`items.${key}.body`)}</p>
              </CardContent>
            </Card>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
