"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

const VALUE_KEYS = ["cloudFirst", "legal", "gatewayOptional"] as const;

const CARD_IMAGES: Record<(typeof VALUE_KEYS)[number], string> = {
  cloudFirst: "/landing/why/carte-01.jpg",
  legal: "/landing/why/carte-02.jpg",
  gatewayOptional: "/landing/why/carte-03.jpg",
};

/**
 * Pen LLhzT « Why & AI » envelope + « Why Ferry » block (3 principle cards).
 * Fade + section shell are ready for L5 (AI agents) as a second child via `children`.
 * Card visuals are decorative (aria-hidden, alt="", no focusables).
 */
export function ValueProps({ children }: { children?: ReactNode }) {
  const t = useTranslations("valueProps");
  const prefersReducedMotion = useReducedMotion();

  return (
    <>
      <div
        aria-hidden="true"
        className="h-20 md:h-[140px] w-full bg-gradient-to-b from-background to-white/3"
      />
      <section
        data-testid="landing-value-props"
        className="bg-white/3"
        aria-labelledby="landing-value-props-title"
      >
        <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-16 md:gap-24 px-6 pt-8 md:pt-12">
          <div className="flex flex-col gap-10 pt-2">
            <p className="w-fit rounded-full border border-white/15 bg-secondary px-2.5 py-1 text-xs text-muted-foreground uppercase">
              {t("eyebrow")}
            </p>

            <div className="grid w-full gap-6 md:grid-cols-2 md:items-start md:justify-between md:gap-6">
              <h2
                id="landing-value-props-title"
                className="font-heading text-3xl leading-9 font-semibold tracking-[-1.2px] text-balance md:text-4xl md:leading-10 lg:text-5xl lg:leading-none"
              >
                {t("title")}
              </h2>
              <p className="text-lg leading-[1.625] text-muted-foreground">
                {t("lead")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {VALUE_KEYS.map((key, index) => (
                <WhyCard
                  key={key}
                  index={index}
                  prefersReducedMotion={!!prefersReducedMotion}
                  imageSrc={CARD_IMAGES[key]}
                  title={t(`items.${key}.title`)}
                  body={t(`items.${key}.body`)}
                />
              ))}
            </div>
          </div>
          {children}
        </div>
      </section>
    </>
  );
}

function WhyCard({
  index,
  prefersReducedMotion,
  imageSrc,
  title,
  body,
}: {
  index: number;
  prefersReducedMotion: boolean;
  imageSrc: string;
  title: string;
  body: string;
}) {
  return (
    <motion.article
      className="flex h-full flex-col gap-3.5 rounded-2xl border border-white/15 bg-muted p-6"
      initial={
        prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }
      }
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.5,
        delay: prefersReducedMotion ? 0 : index * 0.08,
        ease: "easeOut",
      }}
    >
      <div
        aria-hidden="true"
        className="relative h-40 w-full overflow-hidden rounded-xl"
      >
        <Image
          src={imageSrc}
          alt=""
          fill
          className="object-cover"
          sizes="(min-width: 1024px) 309px, 100vw"
        />
      </div>
      <p className="text-[13px] font-semibold tracking-[1px] text-muted-foreground">
        {String(index + 1).padStart(2, "0")}
      </p>
      <h3 className="text-[18px] font-semibold text-foreground">{title}</h3>
      <p className="text-sm leading-normal text-muted-foreground">{body}</p>
    </motion.article>
  );
}
