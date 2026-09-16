"use client";

import { useTranslations } from "next-intl";
import { Separator } from "@/components/ui/separator";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { PassageRule } from "@/components/passage-rule";

const DELIVERY_KEYS = ["kindle", "kobo", "tolino", "usb"] as const;

export function Delivered() {
  const t = useTranslations("delivered");

  return (
    <section id="delivered" className="border-y border-border bg-muted/30">
      <div className="mx-auto max-w-4xl px-6 py-24">
        <Reveal>
          <div className="space-y-3">
            <PassageRule />
            <h2 className="font-heading text-3xl font-medium tracking-tight sm:text-4xl">
              {t("title")}
            </h2>
          </div>
        </Reveal>
        <RevealGroup className="mt-10" stagger={0.1}>
          {DELIVERY_KEYS.map((key, index) => (
            <RevealItem key={key}>
              {index > 0 && <Separator className="bg-border" />}
              <div className="flex items-baseline justify-between gap-6 py-6 transition motion-safe:hover:translate-x-1">
                <span className="font-heading text-xl font-medium sm:text-2xl">
                  {t(`items.${key}.name`)}
                </span>
                <span className="max-w-[14rem] text-right text-sm leading-relaxed text-muted-foreground sm:max-w-none sm:text-base">
                  {t(`items.${key}.body`)}
                </span>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
