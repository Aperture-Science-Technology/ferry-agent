"use client";

import { useTranslations } from "next-intl";
import { Separator } from "@/components/ui/separator";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";

const DELIVERY_KEYS = ["kindle", "kobo", "tolino", "usb"] as const;

export function Delivered() {
  const t = useTranslations("delivered");

  return (
    <section id="delivered" className="mx-auto max-w-4xl px-6 py-24">
      <Reveal>
        <h2 className="font-heading text-3xl font-medium tracking-tight">
          {t("title")}
        </h2>
      </Reveal>
      <RevealGroup className="mt-10" stagger={0.1}>
        {DELIVERY_KEYS.map((key, index) => (
          <RevealItem key={key}>
            {index > 0 && <Separator className="bg-border/60" />}
            <div className="flex items-center justify-between gap-6 py-6 transition hover:translate-x-1">
              <span className="font-heading text-xl font-medium sm:text-2xl">
                {t(`items.${key}.name`)}
              </span>
              <span className="text-right text-muted-foreground">
                {t(`items.${key}.body`)}
              </span>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
