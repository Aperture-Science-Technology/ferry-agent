"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const FAQ_KEYS = [
  "cloudFirst",
  "gatewayNeeded",
  "readers",
  "myData",
  "agent",
] as const;

type FaqKey = (typeof FAQ_KEYS)[number];

/**
 * Pen FAQ — single-open accordion, badge intro, max-w-2xl stack.
 */
export function Faq() {
  const t = useTranslations("faq");
  const baseId = useId();
  const [open, setOpen] = useState<FaqKey>("cloudFirst");

  return (
    <>
      <div
        aria-hidden="true"
        className="h-20 w-full bg-gradient-to-b from-white/3 to-background md:h-[140px]"
      />
      <section
        id="faq"
        data-testid="landing-faq"
        className="scroll-mt-[86px] px-6 pt-6 pb-16 md:pt-6 md:pb-20 lg:scroll-mt-[98px]"
        aria-labelledby={`${baseId}-title`}
      >
        <div className="mx-auto flex w-full flex-col items-center gap-8 md:gap-10">
          <header className="flex w-full flex-col items-center gap-4 text-center">
            <p className="w-fit rounded-full border border-white/15 bg-secondary px-2.5 py-1 text-xs text-muted-foreground uppercase">
              {t("eyebrow")}
            </p>
            <h2
              id={`${baseId}-title`}
              className="text-[30px] leading-[1.1] font-medium tracking-[-0.75px] text-foreground text-balance md:text-5xl md:tracking-[-1.2px]"
            >
              {t("title")}
            </h2>
            <p className="max-w-xl text-base leading-[1.625] text-muted-foreground text-pretty">
              {t("lead")}
            </p>
          </header>

          <div className="flex w-full max-w-2xl flex-col gap-3">
            {FAQ_KEYS.map((key) => {
              const panelId = `${baseId}-panel-${key}`;
              const isOpen = open === key;
              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-2xl px-7 py-6",
                    isOpen
                      ? "flex flex-col gap-4 border border-white/15 bg-muted"
                      : "bg-white/3"
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(key)}
                  >
                    <span className="text-base leading-[1.5] font-medium text-foreground md:text-lg md:leading-[1.5556]">
                      {t(`items.${key}.q`)}
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>
                  {isOpen ? (
                    <p
                      id={panelId}
                      className="text-base leading-normal text-muted-foreground text-pretty"
                    >
                      {t(`items.${key}.a`)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
