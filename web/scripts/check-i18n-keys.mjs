#!/usr/bin/env node
/** Fail if fr.json and en.json do not share the exact same key set. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "messages");

function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === "object" && !Array.isArray(v)
      ? flatten(v, path)
      : [path];
  });
}

const fr = new Set(flatten(JSON.parse(readFileSync(join(root, "fr.json"), "utf8"))));
const en = new Set(flatten(JSON.parse(readFileSync(join(root, "en.json"), "utf8"))));
const onlyFr = [...fr].filter((k) => !en.has(k)).sort();
const onlyEn = [...en].filter((k) => !fr.has(k)).sort();

if (onlyFr.length || onlyEn.length) {
  if (onlyFr.length) console.error("Keys only in fr.json:", onlyFr.join(", "));
  if (onlyEn.length) console.error("Keys only in en.json:", onlyEn.join(", "));
  process.exit(1);
}

console.log(`i18n keys OK (${fr.size} keys in fr.json and en.json)`);
