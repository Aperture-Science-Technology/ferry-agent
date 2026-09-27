/**
 * Regression: marketing / FAQ must not claim a local-only library.
 * Run: node --experimental-strip-types --test lib/product-truth.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const messagesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "messages");

const FORBIDDEN_FR = [
  "Vos livres restent sur votre machine",
  "Rien n'est stocké chez nous",
  "Rien n'est stocké sur des serveurs que nous contrôlons",
  "tout reste chez vous",
  "Il reste chez vous, prêt pour l'envoi",
  "n’est pas confirmé ici",
  "n'est pas confirmé ici",
];

const FORBIDDEN_EN = [
  "Your books stay on your machine",
  "Nothing is stored with us",
  "Nothing is stored on servers we control",
  "everything stays with you",
  "It stays on your side, ready to send",
  "is not confirmed here",
];

/** Phrases that promise a confirmed delivery in hero-facing product copy. */
const FORBIDDEN_HERO_DELIVERY_FR = [
  "livraison confirmée",
  "envoi confirmé",
  "livre livré avec succès",
  "déjà livré",
];

const FORBIDDEN_HERO_DELIVERY_EN = [
  "confirmed delivery",
  "delivery confirmed",
  "successfully delivered",
  "already delivered",
];

const HERO_PRODUCT_KEYS = [
  "badge",
  "titleBefore",
  "titleHighlight",
  "subtitle",
] as const;

const LANDING_HERO_KEYS = [
  "ctaPrimary",
  "ctaSecondary",
  "builtBy",
  "demoTitle",
  "demoBody",
] as const;

function load(locale: "fr" | "en"): string {
  return readFileSync(join(messagesDir, `${locale}.json`), "utf8");
}

function heroProductCopy(messages: {
  hero: Record<string, string>;
  landing: { hero: Record<string, string> };
}): string {
  const parts = [
    ...HERO_PRODUCT_KEYS.map((key) => messages.hero[key]),
    ...LANDING_HERO_KEYS.map((key) => messages.landing.hero[key]),
  ];
  return parts.join("\n");
}

describe("product truth in marketing i18n", () => {
  it("French messages do not promise a local-only library", () => {
    const fr = load("fr");
    for (const phrase of FORBIDDEN_FR) {
      assert.equal(
        fr.includes(phrase),
        false,
        `Forbidden FR phrase still present: ${phrase}`
      );
    }
  });

  it("English messages do not promise a local-only library", () => {
    const en = load("en");
    for (const phrase of FORBIDDEN_EN) {
      assert.equal(
        en.includes(phrase),
        false,
        `Forbidden EN phrase still present: ${phrase}`
      );
    }
  });

  it("both locales state that the library is online / hosted", () => {
    const fr = JSON.parse(load("fr"));
    const en = JSON.parse(load("en"));
    assert.match(fr.valueProps.items.cloudFirst.body, /en ligne|héberg/i);
    assert.match(en.valueProps.items.cloudFirst.body, /online|hosted/i);
    assert.match(fr.faq.items.cloudFirst.a, /en ligne|héberg/i);
    assert.match(en.faq.items.cloudFirst.a, /online|hosted/i);
  });

  it("landing hero presents an online library and a coming-soon demo, not a confirmed delivery", () => {
    const fr = JSON.parse(load("fr"));
    const en = JSON.parse(load("en"));
    assert.match(fr.hero.subtitle, /bibliothèque en ligne/i);
    assert.match(en.hero.subtitle, /online library/i);
    assert.match(fr.landing.hero.demoTitle, /bientôt/i);
    assert.match(en.landing.hero.demoTitle, /coming soon/i);
    assert.match(fr.landing.how.cards.library.title, /bibliothèque en ligne/i);
    assert.match(en.landing.how.cards.library.title, /online library/i);

    const frHero = heroProductCopy(fr);
    const enHero = heroProductCopy(en);
    for (const phrase of [...FORBIDDEN_FR, ...FORBIDDEN_HERO_DELIVERY_FR]) {
      assert.equal(
        frHero.includes(phrase),
        false,
        `Forbidden FR phrase in hero product keys: ${phrase}`
      );
    }
    for (const phrase of [...FORBIDDEN_EN, ...FORBIDDEN_HERO_DELIVERY_EN]) {
      assert.equal(
        enHero.includes(phrase),
        false,
        `Forbidden EN phrase in hero product keys: ${phrase}`
      );
    }
  });
});
