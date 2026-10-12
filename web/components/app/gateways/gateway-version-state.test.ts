import assert from "node:assert/strict";
import test from "node:test";
import { isOlderRelease } from "./gateway-version-state.ts";

test("compare numeric releases and never guess ambiguous versions", () => {
  assert.equal(isOlderRelease("0.1.9", "0.1.10"), true);
  assert.equal(isOlderRelease("v1.0.0", "2.0.0"), true);
  for (const [installed, available] of [["1.0.0", "1.0.0"], ["2.0.0", "1.9.9"], ["unknown", "1.0.0"], ["1.0.0rc1", "1.0.0"], ["1.0.0", undefined], [null, "1.0.0"]]) {
    assert.equal(isOlderRelease(installed, available), false);
  }
});
