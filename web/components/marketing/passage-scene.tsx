"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type PassageSceneProps = {
  className?: string;
};

/**
 * Original landing product scene: online library → demo book → generic e-reader.
 * No card chrome. Labels live in adjacent HTML (next-intl).
 * Assets: /public/illustrations/landing/ (see PROVENANCE.md).
 */
export function PassageScene({ className }: PassageSceneProps) {
  const t = useTranslations("hero");
  const prefersReducedMotion = useReducedMotion();
  const enterY = prefersReducedMotion ? 0 : 7;
  const enterDuration = prefersReducedMotion ? 0 : 0.32;

  return (
    <motion.figure
      data-testid="landing-passage-scene"
      className={cn(
        "relative mx-auto w-full max-w-[78rem]",
        className
      )}
      initial={
        prefersReducedMotion
          ? { opacity: 1, y: 0 }
          : { opacity: 0, y: enterY }
      }
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: enterDuration, ease: [0.2, 0, 0, 1] }}
      aria-labelledby="landing-passage-caption"
    >
      {/* Desktop — wide ~8:5, partially cropped at the bottom */}
      <div className="relative hidden md:block">
        <div className="relative aspect-[8/5] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG scene; no raster optimization */}
          <img
            data-testid="landing-passage-desktop"
            src="/illustrations/landing/passage-desktop.svg"
            alt=""
            width={800}
            height={500}
            className="h-[108%] w-full max-w-none object-cover object-top"
            decoding="async"
          />
          <TravelingBook
            layout="desktop"
            prefersReducedMotion={!!prefersReducedMotion}
          />
        </div>
      </div>

      {/* Mobile — distinct near-square composition */}
      <div className="relative md:hidden">
        <div className="relative aspect-square w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG scene; no raster optimization */}
          <img
            data-testid="landing-passage-mobile"
            src="/illustrations/landing/passage-mobile.svg"
            alt=""
            width={400}
            height={400}
            className="h-[106%] w-full max-w-none object-cover object-top"
            decoding="async"
          />
          <TravelingBook
            layout="mobile"
            prefersReducedMotion={!!prefersReducedMotion}
          />
        </div>
      </div>

      <ul className="mx-auto mt-4 grid max-w-2xl grid-cols-3 gap-2 px-1 text-center text-[0.7rem] leading-snug text-muted-foreground sm:mt-5 sm:text-xs">
        <li>{t("sceneLibrary")}</li>
        <li>{t("sceneBook")}</li>
        <li>{t("sceneReader")}</li>
      </ul>

      <figcaption
        id="landing-passage-caption"
        className="mx-auto mt-3 max-w-xl px-2 pb-10 text-center text-sm text-muted-foreground sm:pb-14"
      >
        {t("sceneCaption")}
      </figcaption>
    </motion.figure>
  );
}

/**
 * One-shot visual example: the demo book travels along the passage arc.
 * Not a delivery status; no loop; skipped when reduced motion is preferred.
 */
function TravelingBook({
  layout,
  prefersReducedMotion,
}: {
  layout: "desktop" | "mobile";
  prefersReducedMotion: boolean;
}) {
  const frames =
    layout === "desktop"
      ? {
          left: ["18%", "42%", "68%"],
          top: ["38%", "22%", "34%"],
        }
      : {
          left: ["28%", "48%", "58%"],
          top: ["28%", "18%", "48%"],
        };

  const sizeClass =
    layout === "desktop"
      ? "h-[14%] w-[7.5%] min-h-[52px] min-w-[36px]"
      : "h-[12%] w-[11%] min-h-[44px] min-w-[32px]";

  return (
    <motion.div
      aria-hidden
      data-testid="landing-passage-travel"
      className={cn("pointer-events-none absolute z-10", sizeClass)}
      initial={
        prefersReducedMotion
          ? { opacity: 1, left: frames.left[2], top: frames.top[2] }
          : { opacity: 1, left: frames.left[0], top: frames.top[0] }
      }
      animate={
        prefersReducedMotion
          ? { opacity: 1, left: frames.left[2], top: frames.top[2] }
          : { opacity: 1, left: frames.left, top: frames.top }
      }
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : {
              duration: 0.75,
              ease: [0.2, 0, 0, 1],
              delay: 0.36,
              times: [0, 0.45, 1],
            }
      }
    >
      <svg
        viewBox="0 0 46 66"
        className="h-full w-full drop-shadow-[0_6px_10px_rgba(61,52,44,0.22)]"
        fill="none"
        role="presentation"
      >
        <rect
          x="0.5"
          y="0.5"
          width="45"
          height="65"
          rx="3"
          fill="#F3EBE1"
          stroke="#BFAE98"
        />
        <rect x="0" y="0" width="7" height="66" rx="2" fill="#A36B3A" />
        <rect
          x="14"
          y="16"
          width="24"
          height="4"
          rx="1"
          fill="#8B7355"
          fillOpacity=".55"
        />
        <rect
          x="14"
          y="26"
          width="18"
          height="3"
          rx="1"
          fill="#8B7355"
          fillOpacity=".35"
        />
        <path
          d="M16 44 C24 34, 34 34, 42 44"
          stroke="#A36B3A"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="16" cy="44" r="2" fill="#A36B3A" />
        <circle cx="42" cy="44" r="2" fill="#A36B3A" />
      </svg>
    </motion.div>
  );
}
