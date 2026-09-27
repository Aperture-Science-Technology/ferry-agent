"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, File, RefreshCw, Usb } from "lucide-react";
import { useTranslations } from "next-intl";

const DEVICE_KEYS = ["kindle", "kobo", "tolino", "usb"] as const;

type DeviceKey = (typeof DEVICE_KEYS)[number];

/**
 * Pen LLhzT « On your device » — 4 destination cards (email, sync, code, USB).
 * Visual mocks are decorative (aria-hidden, no focusables). Title/subtitle are plain HTML.
 */
export function Delivered() {
  const t = useTranslations("landing.devices");
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id="delivered"
      data-testid="landing-on-your-device"
      className="mx-auto w-full max-w-[1152px] px-6 pt-16 pb-12 md:pt-24"
    >
      <div className="flex flex-col gap-10">
        <div className="grid w-full gap-6 md:grid-cols-2 md:items-start md:justify-between">
          <h2 className="font-heading text-3xl leading-9 font-semibold tracking-[-1.2px] text-balance md:text-4xl md:leading-10 lg:text-5xl lg:leading-none">
            {t("title")}
          </h2>
          <p className="text-lg leading-[1.625] text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {DEVICE_KEYS.map((key, index) => (
            <DeviceCard
              key={key}
              deviceKey={key}
              index={index}
              prefersReducedMotion={!!prefersReducedMotion}
              title={t(`cards.${key}.title`)}
              body={t(`cards.${key}.body`)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function DeviceCard({
  deviceKey,
  index,
  prefersReducedMotion,
  title,
  body,
}: {
  deviceKey: DeviceKey;
  index: number;
  prefersReducedMotion: boolean;
  title: string;
  body: string;
}) {
  return (
    <motion.article
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-muted"
      initial={
        prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }
      }
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.5,
        delay: prefersReducedMotion ? 0 : index * 0.08,
      }}
    >
      <div
        aria-hidden="true"
        className="flex h-[180px] flex-col items-center justify-center gap-2.5 bg-black/20 p-4"
      >
        <DeviceVisual deviceKey={deviceKey} />
      </div>
      <div className="flex flex-col gap-2 p-5">
        <h3 className="text-[17px] font-semibold text-foreground">{title}</h3>
        <p className="text-sm leading-normal text-muted-foreground">{body}</p>
      </div>
    </motion.article>
  );
}

function DeviceVisual({ deviceKey }: { deviceKey: DeviceKey }) {
  switch (deviceKey) {
    case "kindle":
      return <KindleVisual />;
    case "kobo":
      return <KoboVisual />;
    case "tolino":
      return <TolinoVisual />;
    case "usb":
      return <UsbVisual />;
  }
}

function KindleVisual() {
  const t = useTranslations("landing.devices.visual");
  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-white/15 bg-muted p-3.5">
      <p className="text-[11px] text-muted-foreground">{t("kindleFrom")}</p>
      <p className="text-[13px] font-semibold text-foreground">
        {t("kindleSubject")}
      </p>
      <div className="flex items-center gap-2 rounded-lg bg-secondary px-2.5 py-2">
        <File className="size-3.5 shrink-0 text-foreground" />
        <span className="text-xs text-foreground">{t("attachment")}</span>
      </div>
    </div>
  );
}

function KoboVisual() {
  const t = useTranslations("landing.devices.visual");
  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-xl border border-white/15 bg-muted p-3.5">
      <RefreshCw className="size-7 text-foreground" />
      <p className="text-[13px] font-medium text-foreground">{t("syncing")}</p>
      <div className="h-1.5 w-[180px] overflow-hidden rounded-full bg-secondary">
        <div className="h-1.5 w-[120px] rounded-full bg-foreground" />
      </div>
    </div>
  );
}

function TolinoVisual() {
  const t = useTranslations("landing.devices.visual");
  return (
    <div className="flex w-full flex-col items-center gap-2.5 rounded-xl border border-white/15 bg-muted p-3.5">
      <p className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
        {t("browserCodeLabel")}
      </p>
      <p className="text-[28px] font-bold tracking-[2px] text-foreground">
        {t("browserCode")}
      </p>
      <p className="text-xs text-muted-foreground">{t("browserCodeHint")}</p>
    </div>
  );
}

function UsbVisual() {
  const t = useTranslations("landing.devices.visual");
  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-white/15 bg-muted p-3.5">
      <Usb className="size-[22px] shrink-0 text-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[13px] font-semibold text-foreground">
          {t("attachment")}
        </p>
        <p className="text-[11px] text-muted-foreground">{t("usbPath")}</p>
      </div>
      <Check className="size-4 shrink-0 text-green-500" />
    </div>
  );
}
