/**
 * Regression: settings dirty detection, Kindle null payload, QR states,
 * and catalog date formatting must stay honest.
 * Run: node --experimental-strip-types --test components/app/settings/settings-state.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyTokenListFetchResult,
  buildSettingsPatchPayload,
  formatTokenCreatedDate,
  formatTokenLastUsed,
  resolveQrRenderState,
  settingsAreDirty,
} from "./settings-state.ts";

describe("settingsAreDirty", () => {
  it("ignores equivalent trimmed Kindle emails and format", () => {
    assert.equal(
      settingsAreDirty("a@kindle.com", "epub", {
        kindleEmail: "a@kindle.com",
        defaultFormat: "epub",
      }),
      false
    );
    assert.equal(
      settingsAreDirty("  a@kindle.com  ", "epub", {
        kindleEmail: "a@kindle.com",
        defaultFormat: "epub",
      }),
      false
    );
  });

  it("flags changes to Kindle email or default format", () => {
    assert.equal(
      settingsAreDirty("b@kindle.com", "epub", {
        kindleEmail: "a@kindle.com",
        defaultFormat: "epub",
      }),
      true
    );
    assert.equal(
      settingsAreDirty("a@kindle.com", "mobi", {
        kindleEmail: "a@kindle.com",
        defaultFormat: "epub",
      }),
      true
    );
    assert.equal(
      settingsAreDirty("", "epub", {
        kindleEmail: "a@kindle.com",
        defaultFormat: "epub",
      }),
      true
    );
  });
});

describe("buildSettingsPatchPayload", () => {
  it("sends null when Kindle email is cleared", () => {
    assert.deepEqual(buildSettingsPatchPayload("  ", "pdf"), {
      kindle_email: null,
      default_format: "pdf",
    });
    assert.deepEqual(buildSettingsPatchPayload("user@kindle.com", "azw3"), {
      kindle_email: "user@kindle.com",
      default_format: "azw3",
    });
  });
});

describe("formatTokenLastUsed", () => {
  it("returns never label for empty or invalid dates", () => {
    assert.equal(formatTokenLastUsed(null, "fr", "Jamais"), "Jamais");
    assert.equal(formatTokenLastUsed("not-a-date", "en", "Never"), "Never");
  });

  it("formats with the app locale, not a hard-coded browser default", () => {
    const value = "2026-01-15T12:00:00.000Z";
    const fr = formatTokenLastUsed(value, "fr", "Jamais");
    const en = formatTokenLastUsed(value, "en", "Never");
    assert.notEqual(fr, "Jamais");
    assert.notEqual(en, "Never");
    assert.equal(typeof fr, "string");
    assert.equal(typeof en, "string");
  });
});

describe("formatTokenCreatedDate", () => {
  it("formats a calendar date for OPDS row meta", () => {
    const value = "2026-01-15T12:00:00.000Z";
    const fr = formatTokenCreatedDate(value, "fr");
    const en = formatTokenCreatedDate(value, "en");
    assert.match(fr, /2026/);
    assert.match(en, /2026/);
    assert.equal(formatTokenCreatedDate("not-a-date", "fr"), "not-a-date");
  });
});

describe("resolveQrRenderState", () => {
  it("distinguishes loading, ready, and error without collapsing error into loading", () => {
    assert.equal(resolveQrRenderState(null, false), "loading");
    assert.equal(resolveQrRenderState("data:image/png;base64,abc", false), "ready");
    assert.equal(resolveQrRenderState(null, true), "error");
    assert.equal(resolveQrRenderState("data:image/png;base64,abc", true), "error");
  });
});

describe("applyTokenListFetchResult", () => {
  it("keeps previous tokens when a refresh fails", () => {
    const previous = [{ id: "1" }];
    assert.deepEqual(applyTokenListFetchResult(previous, null), {
      ok: false,
      items: previous,
      keptPrevious: true,
    });
    assert.deepEqual(applyTokenListFetchResult(previous, [{ id: "2" }]), {
      ok: true,
      items: [{ id: "2" }],
    });
  });
});
