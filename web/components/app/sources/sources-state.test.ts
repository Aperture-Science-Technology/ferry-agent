/**
 * Regression: a source missing from the API payload must not look enabled;
 * a failed toggle must not flip the previous state.
 * Run: node --experimental-strip-types --test components/app/sources/sources-state.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applySourceToggleFailure,
  applySourceToggleSuccess,
  canToggleSource,
  findSourceByType,
  sourceAvailability,
  sourceGroup,
  sourceRowKind,
  type SourceLike,
} from "./sources-state.ts";

const gutenbergOn: SourceLike = {
  id: "g1",
  type: "gutenberg",
  enabled: true,
};
const standardOff: SourceLike = {
  id: "s1",
  type: "standard_ebooks",
  enabled: false,
};
const upload: SourceLike = {
  id: "u1",
  type: "upload",
  enabled: true,
};

describe("sourceRowKind / sourceGroup", () => {
  it("splits open-access toggles from local upload and gateway rows", () => {
    assert.equal(sourceRowKind("gutenberg"), "toggleable");
    assert.equal(sourceRowKind("standard_ebooks"), "toggleable");
    assert.equal(sourceRowKind("upload"), "upload");
    assert.equal(sourceRowKind("torrent_gateway"), "gateway_local");
    assert.equal(sourceGroup("gutenberg"), "openAccess");
    assert.equal(sourceGroup("torrent_gateway"), "local");
  });
});

describe("sourceAvailability (T10)", () => {
  it("marks activable sources enabled/disabled only when present in the payload", () => {
    const sources = [gutenbergOn, standardOff, upload];
    assert.equal(sourceAvailability("gutenberg", sources, false), "enabled");
    assert.equal(sourceAvailability("standard_ebooks", sources, false), "disabled");
  });

  it("does not invent enabled when a toggleable type is absent", () => {
    assert.equal(sourceAvailability("gutenberg", [upload], false), "unknown");
    assert.equal(sourceAvailability("standard_ebooks", [], false), "unknown");
  });

  it("marks all toggleable rows unknown when the list fetch failed", () => {
    assert.equal(
      sourceAvailability("gutenberg", [gutenbergOn], true),
      "unknown"
    );
    assert.equal(
      sourceAvailability("standard_ebooks", [standardOff], true),
      "unknown"
    );
  });

  it("keeps upload always-on and gateway as local-module without claiming connected", () => {
    assert.equal(sourceAvailability("upload", [], false), "always_on");
    assert.equal(sourceAvailability("torrent_gateway", [], false), "gateway");
    assert.equal(sourceAvailability("upload", [], true), "always_on");
    assert.equal(sourceAvailability("torrent_gateway", [], true), "gateway");
  });
});

describe("canToggleSource", () => {
  it("allows toggles only for known activable rows when the list is available", () => {
    const sources = [gutenbergOn, upload];
    assert.equal(canToggleSource("gutenberg", sources, false), true);
    assert.equal(canToggleSource("standard_ebooks", sources, false), false);
    assert.equal(canToggleSource("upload", sources, false), false);
    assert.equal(canToggleSource("torrent_gateway", sources, false), false);
    assert.equal(canToggleSource("gutenberg", sources, true), false);
  });
});

describe("toggle apply helpers", () => {
  it("replaces the patched source on success and preserves siblings", () => {
    const previous = [gutenbergOn, standardOff];
    const updated = { ...gutenbergOn, enabled: false };
    assert.deepEqual(applySourceToggleSuccess(previous, updated), [
      updated,
      standardOff,
    ]);
  });

  it("keeps the previous list on failure (no false enabled state)", () => {
    const previous = [gutenbergOn, standardOff];
    assert.deepEqual(applySourceToggleFailure(previous), previous);
    assert.equal(findSourceByType(previous, "gutenberg")?.enabled, true);
  });
});
