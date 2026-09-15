/**
 * Regression: clearing or switching jobId must not keep a previous poll view.
 * Run: node --experimental-strip-types --test lib/gateway-job-state.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveGatewayJobView,
  type GatewayJobPollSnapshot,
} from "./gateway-job-state.ts";

const snapshot: GatewayJobPollSnapshot = {
  jobId: "job-a",
  status: "running",
  libraryItemId: "book-1",
  error: null,
  attempts: 2,
};

describe("resolveGatewayJobView", () => {
  it("returns a cleared view when jobId is null (not the previous snapshot)", () => {
    assert.deepEqual(resolveGatewayJobView(null, snapshot), {
      status: null,
      libraryItemId: null,
      error: null,
      attempts: 0,
    });
  });

  it("ignores a snapshot that belongs to another jobId", () => {
    assert.deepEqual(resolveGatewayJobView("job-b", snapshot), {
      status: null,
      libraryItemId: null,
      error: null,
      attempts: 0,
    });
  });

  it("exposes the snapshot only when jobIds match", () => {
    assert.deepEqual(resolveGatewayJobView("job-a", snapshot), {
      status: "running",
      libraryItemId: "book-1",
      error: null,
      attempts: 2,
    });
  });
});
