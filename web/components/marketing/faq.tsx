"use client";

import { useTranslations } from "next-intl";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal } from "@/components/motion/reveal";
import { PassageRule } from "@/components/passage-rule";

const FAQ_KEYS = ["cloudFirst", "gatewayNeeded", "readers", "myData", "agent"] as const;

export function Faq() {
  const t = useTranslations("faq");

  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
      <Reveal>
        <div className="space-y-3">
          <PassageRule />
          <h2 className="font-heading text-3xl font-medium tracking-tight sm:text-4xl">
            {t("title")}
          </h2>
        </div>
      </Reveal>
      <Reveal delay={0.1} className="mt-8">
        <Accordion>
          {FAQ_KEYS.map((key, index) => (
            <AccordionItem key={key} value={`item-${index}`}>
              <AccordionTrigger className="font-heading text-left text-lg font-medium">
                {t(`items.${key}.q`)}
              </AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">
                {t(`items.${key}.a`)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </section>
  );
}
