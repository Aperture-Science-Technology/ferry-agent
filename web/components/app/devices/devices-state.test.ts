/**
 * Regression: device soft-refresh must not look empty on failure;
 * display names stay user-readable without inventing gateway context.
 * Run: node --experimental-strip-types --test components/app/devices/devices-state.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyDeviceFetchResult,
  cloudLinkPresentation,
  deviceDisplayName,
} from "./devices-state.ts";

describe("deviceDisplayName", () => {
  it("prefers the custom name when present", () => {
    assert.equal(
      deviceDisplayName({ name: "Salon", model: "Paperwhite" }, "Kindle"),
      "Salon"
    );
  });

  it("falls back to brand and model, then brand alone", () => {
    assert.equal(
      deviceDisplayName({ name: null, model: "Clara" }, "Kobo"),
      "Kobo — Clara"
    );
    assert.equal(
      deviceDisplayName({ name: "  ", model: null }, "Tolino"),
      "Tolino"
    );
  });
});

describe("applyDeviceFetchResult", () => {
  it("keeps previous devices when refresh fails (not an empty list)", () => {
    const previous = [{ id: "1" }];
    const outcome = applyDeviceFetchResult(previous, null);
    assert.equal(outcome.ok, false);
    assert.deepEqual(outcome.items, previous);
  });

  it("uses the fresh list on success", () => {
    const outcome = applyDeviceFetchResult([{ id: "1" }], [{ id: "2" }]);
    assert.equal(outcome.ok, true);
    assert.deepEqual(outcome.items, [{ id: "2" }]);
  });
});

describe("cloudLinkPresentation", () => {
  it("distinguishes linked from not linked without inventing a provider", () => {
    assert.equal(cloudLinkPresentation({ cloud_linked: true }), "linked");
    assert.equal(cloudLinkPresentation({ cloud_linked: false }), "not_linked");
  });
});
