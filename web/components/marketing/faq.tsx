"use client";

import { useTranslations } from "next-intl";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal } from "@/components/motion/reveal";

const FAQ_KEYS = ["selfHosted", "gatewayNeeded", "readers", "myData", "agent"] as const;

export function Faq() {
  const t = useTranslations("faq");

  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
      <Reveal>
        <h2 className="font-heading text-3xl font-medium tracking-tight">
          {t("title")}
        </h2>
      </Reveal>
      <Reveal delay={0.1} className="mt-8">
        <Accordion>
          {FAQ_KEYS.map((key, index) => (
            <AccordionItem key={key} value={`item-${index}`}>
              <AccordionTrigger className="font-heading text-left text-lg font-medium">
                {t(`items.${key}.q`)}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {t(`items.${key}.a`)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </section>
  );
}
