"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { PassageRule } from "@/components/passage-rule";

export function McpSpotlight() {
  const t = useTranslations("mcpSpotlight");

  return (
    <section id="mcp" className="border-y border-border">
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <Reveal>
          <div className="mb-5 flex justify-center">
            <PassageRule />
          </div>
          <p className="mb-4 text-sm font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {t("eyebrow")}
          </p>
          <h2 className="font-heading text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-balance">
            {t("body")}
          </p>
          <div className="mt-8 flex justify-center">
            <Button render={<Link href="/docs">{t("cta")}</Link>} />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
