"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { Check, Search, Send, Tablet } from "lucide-react";
import { useTranslations } from "next-intl";

const CARD_KEYS = [
  "library",
  "send",
  "search",
  "sources",
  "queue",
] as const;

type CardKey = (typeof CARD_KEYS)[number];

/**
 * Pen LLhzT « How it works » — split section heading + 5 product cards (2 then 3).
 * Visual mocks are decorative (aria-hidden, no focusables). Title/subtitle are plain HTML.
 */
export function HowItWorks() {
  const t = useTranslations("landing.how");
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id="how-it-works"
      data-testid="landing-how-it-works"
      className="mx-auto w-full max-w-[1152px] scroll-mt-[86px] px-6 pt-16 md:pt-24 lg:scroll-mt-[98px]"
    >
      <div className="flex flex-col gap-12">
        <div className="grid w-full max-w-[880px] gap-6 md:grid-cols-2 md:items-start md:justify-between">
          <h2 className="font-heading text-3xl leading-9 font-semibold tracking-[-1.2px] text-balance sm:text-4xl sm:leading-10 md:text-5xl md:leading-none">
            {t("title")}
          </h2>
          <p className="text-lg leading-[1.625] text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {CARD_KEYS.slice(0, 2).map((key, index) => (
              <FeatureCard
                key={key}
                cardKey={key}
                index={index}
                prefersReducedMotion={!!prefersReducedMotion}
                title={t(`cards.${key}.title`)}
                body={t(`cards.${key}.body`)}
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {CARD_KEYS.slice(2).map((key, index) => (
              <FeatureCard
                key={key}
                cardKey={key}
                index={index + 2}
                prefersReducedMotion={!!prefersReducedMotion}
                title={t(`cards.${key}.title`)}
                body={t(`cards.${key}.body`)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  cardKey,
  index,
  prefersReducedMotion,
  title,
  body,
}: {
  cardKey: CardKey;
  index: number;
  prefersReducedMotion: boolean;
  title: string;
  body: string;
}) {
  return (
    <motion.article
      className="flex h-full flex-col gap-6 overflow-hidden rounded-2xl border border-white/15 bg-muted p-5"
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
      <div aria-hidden="true" className="h-[300px] overflow-hidden">
        <CardVisual cardKey={cardKey} />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-base leading-[1.625] text-muted-foreground">
          {body}
        </p>
      </div>
    </motion.article>
  );
}

function CardVisual({ cardKey }: { cardKey: CardKey }) {
  switch (cardKey) {
    case "library":
      return <LibraryVisual />;
    case "send":
      return <SendVisual />;
    case "search":
      return <SearchVisual />;
    case "sources":
      return <SourcesVisual />;
    case "queue":
      return <QueueVisual />;
  }
}

function LibraryVisual() {
  const t = useTranslations("landing.how.visual");
  const rows = [
    {
      cover: "/landing/covers/pride-and-prejudice.jpg",
      title: t("bookPride"),
      meta: t("metaAusten"),
      source: t("sourceGutenberg"),
    },
    {
      cover: "/landing/covers/frankenstein.jpg",
      title: t("bookFrankenstein"),
      meta: t("metaShelley"),
      source: t("sourceStdEbooks"),
    },
    {
      cover: "/landing/covers/moby-dick.jpg",
      title: t("bookMoby"),
      meta: t("metaMelville"),
      source: t("sourceImport"),
    },
  ] as const;

  return (
    <div className="flex h-full flex-col justify-center gap-2 px-4 py-8">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">
          {t("libraryHeading")}
        </span>
        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-muted-foreground">
          {t("libraryCount")}
        </span>
      </div>
      {rows.map((row) => (
        <div
          key={row.title}
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-2.5"
        >
          <Image
            src={row.cover}
            alt=""
            width={28}
            height={36}
            className="h-9 w-7 shrink-0 rounded object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">
              {row.title}
            </p>
            <p className="text-[10px] text-muted-foreground">{row.meta}</p>
          </div>
          <span className="shrink-0 rounded-full bg-white/5 px-2 py-1 text-[10px] text-foreground">
            {row.source}
          </span>
        </div>
      ))}
    </div>
  );
}

function SendVisual() {
  const t = useTranslations("landing.how.visual");

  return (
    <div className="flex h-full flex-col justify-center gap-2 px-4 py-8">
      <div className="flex flex-col gap-2.5 rounded-[14px] border border-white/10 bg-black/20 p-3">
        <div className="flex items-center gap-3">
          <span className="h-12 w-9 shrink-0 rounded bg-blue-600" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-muted-foreground">{t("sending")}</p>
            <p className="text-sm font-semibold text-foreground">
              {t("bookGatsby")}
            </p>
            <p className="text-[11px] text-muted-foreground">{t("gatsbyMeta")}</p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">{t("sendTo")}</p>

        <div className="flex items-center gap-2.5 rounded-[10px] border border-blue-500 bg-blue-950 px-2.5 py-2">
          <Tablet className="size-3.5 shrink-0 text-blue-400" />
          <span className="min-w-0 flex-1 text-xs font-semibold text-foreground">
            {t("deviceKindle")}
          </span>
          <Check className="size-3.5 shrink-0 text-blue-400" />
        </div>

        <div className="flex items-center gap-2.5 rounded-[10px] border border-white/10 bg-white/5 px-2.5 py-2">
          <Tablet className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
            {t("deviceKobo")}
          </span>
        </div>

        <span className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-foreground px-3.5 py-2.5 text-[13px] font-semibold text-background">
          <Send className="size-3.5 shrink-0" />
          {t("sendButton")}
        </span>
      </div>
    </div>
  );
}

function SearchVisual() {
  const t = useTranslations("landing.how.visual");

  return (
    <div className="flex h-full flex-col justify-center gap-2 px-4 py-8">
      <div className="flex items-center gap-2 rounded-[10px] border border-white/10 bg-black/20 px-2.5 py-2">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs text-foreground">{t("searchQuery")}</span>
      </div>

      <div className="flex items-center gap-2 rounded-[10px] border border-blue-500 bg-blue-950 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">
            {t("bookPride")}
          </p>
          <p className="text-[10px] text-muted-foreground">{t("authorAusten")}</p>
        </div>
        <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-blue-400">
          {t("sourceGutenberg")}
        </span>
      </div>

      <div className="flex items-center gap-2 rounded-[10px] border border-white/10 bg-black/20 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">
            {t("bookPride")}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {t("annotatedEdition")}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-blue-400">
          {t("sourceStdEbooks")}
        </span>
      </div>
    </div>
  );
}

function SourcesVisual() {
  const t = useTranslations("landing.how.visual");
  const rows = [
    { name: t("projectGutenberg"), badge: t("connected"), optional: false },
    { name: t("standardEbooks"), badge: t("connected"), optional: false },
    { name: t("yourFiles"), badge: t("connected"), optional: false },
    { name: t("localGateway"), badge: t("optional"), optional: true },
  ] as const;

  return (
    <div className="flex h-full flex-col justify-center gap-2 px-4 py-8">
      {rows.map((row) => (
        <div
          key={row.name}
          className="flex items-center gap-2.5 rounded-[10px] border border-white/10 bg-black/20 px-2.5 py-2"
        >
          <span className="size-5 shrink-0 rounded bg-white/5" />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
            {row.name}
          </span>
          <span
            className={
              row.optional
                ? "shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground"
                : "shrink-0 rounded-md bg-green-950 px-1.5 py-0.5 text-[9px] font-semibold text-green-400"
            }
          >
            {row.badge}
          </span>
        </div>
      ))}
    </div>
  );
}

function QueueVisual() {
  const t = useTranslations("landing.how.visual");
  const tStatus = useTranslations("deliveries.statuses");
  const rows = [
    {
      device: t("deviceKindle"),
      book: t("bookGatsbyShort"),
      status: tStatus("delivered"),
      statusClass: "text-green-500",
      dotClass: "bg-green-500",
    },
    {
      device: t("deviceKobo"),
      book: t("bookFrankenstein"),
      status: tStatus("queued"),
      statusClass: "text-yellow-500",
      dotClass: "bg-yellow-500",
    },
    {
      device: t("deviceTolino"),
      book: t("bookMoby"),
      status: tStatus("sent"),
      statusClass: "text-blue-400",
      dotClass: "bg-blue-400",
    },
  ] as const;

  return (
    <div className="flex h-full flex-col justify-center gap-2 px-4 py-8">
      <div className="flex items-center gap-2 rounded-[10px] border border-white/10 bg-black/20 p-2.5">
        <span className="text-[11px] font-medium text-foreground">
          {t("queueHeading")}
        </span>
      </div>
      {rows.map((row) => (
        <div
          key={row.device}
          className="flex items-center gap-2 rounded-[10px] border border-white/10 bg-black/20 px-2.5 py-2"
        >
          <Tablet className="size-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-foreground">
              {row.device}
            </p>
            <p className="text-[10px] text-muted-foreground">{row.book}</p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 text-[10px] font-semibold ${row.statusClass}`}
          >
            <span className={`size-1.5 rounded-full ${row.dotClass}`} />
            {row.status}
          </span>
        </div>
      ))}
    </div>
  );
}
