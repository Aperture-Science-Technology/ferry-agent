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

function load(locale: "fr" | "en"): string {
  return readFileSync(join(messagesDir, `${locale}.json`), "utf8");
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
});
