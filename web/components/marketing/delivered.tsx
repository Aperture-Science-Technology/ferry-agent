"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, File, RefreshCw, Usb } from "lucide-react";
import { useTranslations } from "next-intl";

import { KindleLogo, KoboLogo } from "@/components/app/devices/brand-logos";

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
      className="mx-auto w-full max-w-[1152px] scroll-mt-[86px] px-6 pt-16 pb-12 md:pt-24 lg:scroll-mt-[98px]"
    >
      <div className="flex flex-col gap-10">
        <div className="grid w-full gap-6 md:grid-cols-2 md:items-start md:justify-between">
          <h2 className="font-heading text-3xl leading-9 font-semibold tracking-[-1.2px] text-balance sm:text-4xl sm:leading-10 md:text-5xl md:leading-none">
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
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-secondary ring-1 ring-inset ring-white/[0.06]"
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
        className="flex h-[180px] items-center justify-center bg-black/25 p-4"
      >
        <DeviceVisual deviceKey={deviceKey} />
      </div>
      <div className="flex flex-col gap-2 p-5">
        <div className="flex items-center gap-2.5">
          <DeviceBrand deviceKey={deviceKey} />
          <h3 className="text-[17px] font-semibold text-foreground">{title}</h3>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </motion.article>
  );
}

function DeviceBrand({ deviceKey }: { deviceKey: DeviceKey }) {
  switch (deviceKey) {
    case "kindle":
      return (
        <KindleLogo aria-hidden className="h-4 w-auto text-foreground" />
      );
    case "kobo":
      return <KoboLogo aria-hidden className="h-4 w-auto text-foreground" />;
    case "tolino":
      return (
        <span
          aria-hidden
          className="text-[13px] font-semibold tracking-tight lowercase text-foreground"
        >
          tolino
        </span>
      );
    case "usb":
      return <Usb aria-hidden className="h-4 w-4 text-foreground" />;
  }
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

function ChannelLabel({ label }: { label: string }) {
  return (
    <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
      {label}
    </p>
  );
}

function KindleVisual() {
  const t = useTranslations("landing.devices.visual");
  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-white/10 bg-black/45 p-3.5">
      <ChannelLabel label={t("channelEmail")} />
      <p className="text-xs text-muted-foreground">{t("kindleFrom")}</p>
      <p className="text-[15px] font-semibold text-foreground">
        {t("kindleSubject")}
      </p>
      <div className="flex items-center gap-2 rounded-lg bg-secondary px-2.5 py-2 text-xs text-foreground">
        <File className="size-4 shrink-0" />
        <span>{t("attachment")}</span>
      </div>
    </div>
  );
}

function KoboVisual() {
  const t = useTranslations("landing.devices.visual");
  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-white/10 bg-black/45 p-3.5">
      <ChannelLabel label={t("channelSync")} />
      <div className="flex items-center gap-2">
        <RefreshCw className="size-5 shrink-0 text-foreground" />
        <p className="text-sm font-medium text-foreground">{t("syncing")}</p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-1.5 w-[66%] rounded-full bg-foreground" />
      </div>
    </div>
  );
}

function TolinoVisual() {
  const t = useTranslations("landing.devices.visual");
  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-white/10 bg-black/45 p-3.5">
      <ChannelLabel label={t("channelBrowser")} />
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
    <div className="flex w-full flex-col gap-2 rounded-xl border border-white/10 bg-black/45 p-3.5">
      <ChannelLabel label={t("channelCable")} />
      <div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
        <Usb className="size-5 shrink-0 text-foreground" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="truncate text-[13px] font-semibold text-foreground">
            {t("attachment")}
          </p>
          <p className="text-xs text-muted-foreground">{t("usbPath")}</p>
        </div>
        <Check className="size-4 shrink-0 text-green-500" />
      </div>
    </div>
  );
}
