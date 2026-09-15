/**
 * Regression: delivery refresh must update status without blanking known rows,
 * and a failed fetch must not look like an empty list.
 * Run: node --experimental-strip-types --test components/app/deliveries/deliveries-state.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyDeliveryFetchResult,
  hasActiveDeliveries,
  isActiveDeliveryStatus,
  isTerminalDeliveryStatus,
  mergeDeliveryJobs,
  normalizeDeliveryStatus,
} from "./deliveries-state.ts";

describe("normalizeDeliveryStatus", () => {
  it("keeps known statuses and marks others as unknown", () => {
    assert.equal(normalizeDeliveryStatus("queued"), "queued");
    assert.equal(normalizeDeliveryStatus("sent"), "sent");
    assert.equal(normalizeDeliveryStatus("delivered"), "delivered");
    assert.equal(normalizeDeliveryStatus("failed"), "failed");
    assert.equal(normalizeDeliveryStatus("weird"), "unknown");
  });
});

describe("active vs terminal", () => {
  it("treats queued/sent as active and delivered/failed as terminal", () => {
    assert.equal(isActiveDeliveryStatus("queued"), true);
    assert.equal(isActiveDeliveryStatus("sent"), true);
    assert.equal(isActiveDeliveryStatus("delivered"), false);
    assert.equal(isTerminalDeliveryStatus("delivered"), true);
    assert.equal(isTerminalDeliveryStatus("failed"), true);
    assert.equal(isTerminalDeliveryStatus("queued"), false);
  });

  it("detects active rows for bounded polling", () => {
    assert.equal(
      hasActiveDeliveries([
        { id: "1", status: "delivered" },
        { id: "2", status: "queued" },
      ]),
      true
    );
    assert.equal(
      hasActiveDeliveries([{ id: "1", status: "failed" }]),
      false
    );
  });
});

describe("mergeDeliveryJobs", () => {
  it("updates status from fresh list while keeping prior title enrichment", () => {
    const previous = [
      {
        id: "a",
        status: "queued",
        item_title: "Known Title",
        download_url: null as string | null,
      },
    ];
    const fresh = [
      {
        id: "a",
        status: "delivered",
        item_title: null as string | null,
        download_url: "https://example.test/file",
      },
    ];
    const merged = mergeDeliveryJobs(previous, fresh);
    assert.equal(merged[0]?.status, "delivered");
    assert.equal(merged[0]?.item_title, "Known Title");
    assert.equal(merged[0]?.download_url, "https://example.test/file");
  });
});

describe("applyDeliveryFetchResult", () => {
  it("keeps previous items when refresh fails (not an empty list)", () => {
    const previous = [{ id: "a", status: "sent" }];
    const outcome = applyDeliveryFetchResult(previous, null);
    assert.equal(outcome.ok, false);
    assert.deepEqual(outcome.items, previous);
  });

  it("replaces with merged fresh list on success", () => {
    const previous = [{ id: "a", status: "queued", item_title: "Book" }];
    const fresh = [{ id: "a", status: "sent", item_title: "Book" }];
    const outcome = applyDeliveryFetchResult(previous, fresh);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.items[0]?.status, "sent");
  });
});
