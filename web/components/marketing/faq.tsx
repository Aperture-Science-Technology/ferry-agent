"use client";

import { useTranslations } from "next-intl";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PassageRule } from "@/components/passage-rule";

const FAQ_KEYS = ["cloudFirst", "gatewayNeeded", "readers", "myData", "agent"] as const;

/**
 * Landing FAQ — accessible shadcn accordion, editorial paper hierarchy.
 * No entrance fade: copy stays readable without motion (accordion panel only).
 */
export function Faq() {
  const t = useTranslations("faq");

  return (
    <section
      id="faq"
      data-testid="landing-faq"
      className="mx-auto max-w-3xl px-6 py-24"
      aria-labelledby="landing-faq-title"
    >
      <header className="space-y-3">
        <PassageRule />
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          {t("eyebrow")}
        </p>
        <h2
          id="landing-faq-title"
          className="font-heading text-3xl font-medium tracking-tight text-balance sm:text-4xl"
        >
          {t("title")}
        </h2>
      </header>

      <Accordion className="mt-10">
        {FAQ_KEYS.map((key) => (
          <AccordionItem key={key} value={key} className="border-border">
            <AccordionTrigger className="font-heading py-5 text-left text-base font-medium tracking-tight sm:text-lg">
              {t(`items.${key}.q`)}
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-base leading-relaxed text-muted-foreground text-pretty">
              {t(`items.${key}.a`)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
