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
  deliveryStatusLabelKey,
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

  it("never maps an unrecognized status to delivered (success)", () => {
    for (const raw of [
      "",
      "complete",
      "success",
      "DONE",
      "Delivered",
      "in_transit",
      "ok",
    ]) {
      const normalized = normalizeDeliveryStatus(raw);
      assert.equal(normalized, "unknown");
      assert.notEqual(normalized, "delivered");
    }
  });
});

describe("active vs terminal", () => {
  it("uses API semantics: email sent is terminal, cloud sent remains active", () => {
    assert.equal(isActiveDeliveryStatus({ status: "queued", terminal: false }), true);
    assert.equal(isActiveDeliveryStatus({ status: "sent", terminal: true }), false);
    assert.equal(isActiveDeliveryStatus({ status: "sent", terminal: false }), true);
    assert.equal(isActiveDeliveryStatus({ status: "delivered", terminal: true }), false);
    assert.equal(isTerminalDeliveryStatus({ status: "delivered", terminal: true }), true);
    assert.equal(isTerminalDeliveryStatus({ status: "failed", terminal: true }), true);
    assert.equal(isTerminalDeliveryStatus({ status: "queued", terminal: false }), false);
    assert.equal(isTerminalDeliveryStatus({ status: "unknown", terminal: true }), false);
    assert.equal(isTerminalDeliveryStatus({ status: "sent" }), false);
    assert.equal(deliveryStatusLabelKey({ status: "sent", method: "email" }), "sentEmail");
    assert.equal(deliveryStatusLabelKey({ status: "sent", method: "drive" }), "sent");
  });

  it("detects active rows for bounded polling", () => {
    assert.equal(
      hasActiveDeliveries([
        { id: "1", status: "delivered", terminal: true },
        { id: "2", status: "queued", terminal: false },
      ]),
      true
    );
    assert.equal(
      hasActiveDeliveries([{ id: "1", status: "failed", terminal: true }]),
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


describe("terminal semantics after refresh", () => {
  it("does not retain stale terminal semantics when a response omits them", () => {
    const merged = mergeDeliveryJobs([{ id: "a", status: "sent", terminal: true }], [{ id: "a", status: "unknown" }]);
    assert.equal(isTerminalDeliveryStatus(merged[0]!), false);
  });
});


it("keeps an empty unknown status visible after a formerly terminal job", () => {
  const merged = mergeDeliveryJobs([{ id: "a", status: "delivered", terminal: true }], [{ id: "a", status: "", terminal: true }]);
  assert.equal(normalizeDeliveryStatus(merged[0]!.status), "unknown");
  assert.equal(isTerminalDeliveryStatus(merged[0]!), false);
});
