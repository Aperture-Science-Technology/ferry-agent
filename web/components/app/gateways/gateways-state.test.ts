/**
 * Regression: Gateway activity error must not look empty; connection buckets
 * and soft list refresh must stay honest.
 * Run: node --experimental-strip-types --test components/app/gateways/gateways-state.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyActivityFetchResult,
  applyGatewayListFetchResult,
  copyTextToClipboard,
  gatewayConnectionPresentation,
  isGatewayOnline,
  isPairingExpired,
  minutesUntil,
  normalizeJobStatus,
} from "./gateways-state.ts";

describe("minutesUntil / pairing expiry", () => {
  it("detects expired pairing codes for pending gateways only", () => {
    const now = Date.parse("2026-09-15T12:00:00.000Z");
    const expired = {
      status: "pending",
      pairing_expires_at: "2026-09-15T11:59:00.000Z",
    };
    const stillValid = {
      status: "pending",
      pairing_expires_at: "2026-09-15T12:10:00.000Z",
    };
    const paired = {
      status: "paired",
      pairing_expires_at: "2026-09-15T11:59:00.000Z",
    };

    assert.equal(isPairingExpired(expired, now), true);
    assert.equal(isPairingExpired(stillValid, now), false);
    assert.equal(isPairingExpired(paired, now), false);
    assert.equal(minutesUntil(stillValid.pairing_expires_at, now), 10);
  });

  it("expired pairing is never presented as connected/online", () => {
    const now = Date.parse("2026-09-15T12:00:00.000Z");
    const expiredPending = {
      gateway_id: "e",
      status: "pending",
      pairing_expires_at: "2026-09-15T11:00:00.000Z",
      last_seen_at: "2026-09-15T11:59:50.000Z",
      gateway_online_seconds: 60,
    };
    assert.equal(gatewayConnectionPresentation(expiredPending, now), "expired");
    assert.notEqual(
      gatewayConnectionPresentation(expiredPending, now),
      "connected"
    );
  });
});

describe("online window / connection presentation", () => {
  it("marks paired gateways connected only inside the online window", () => {
    const now = Date.parse("2026-09-15T12:00:00.000Z");
    const online = {
      gateway_id: "g1",
      status: "paired",
      last_seen_at: "2026-09-15T11:59:30.000Z",
      gateway_online_seconds: 60,
    };
    const offline = {
      gateway_id: "g2",
      status: "paired",
      last_seen_at: "2026-09-15T11:50:00.000Z",
      gateway_online_seconds: 60,
    };

    assert.equal(isGatewayOnline(online, now), true);
    assert.equal(isGatewayOnline(offline, now), false);
    assert.equal(gatewayConnectionPresentation(online, now), "connected");
    assert.equal(gatewayConnectionPresentation(offline, now), "offline");
  });

  it("absent or cold heartbeat is offline, never connected", () => {
    const now = Date.parse("2026-09-15T12:00:00.000Z");
    const noHeartbeat = {
      gateway_id: "cold",
      status: "paired",
      last_seen_at: null,
      gateway_online_seconds: 60,
    };
    const coldHeartbeat = {
      gateway_id: "stale",
      status: "paired",
      last_seen_at: "2026-09-15T11:00:00.000Z",
      gateway_online_seconds: 60,
    };

    assert.equal(isGatewayOnline(noHeartbeat, now), false);
    assert.equal(isGatewayOnline(coldHeartbeat, now), false);
    assert.equal(gatewayConnectionPresentation(noHeartbeat, now), "offline");
    assert.equal(gatewayConnectionPresentation(coldHeartbeat, now), "offline");
    assert.notEqual(
      gatewayConnectionPresentation(noHeartbeat, now),
      "connected"
    );
  });

  it("maps pending/expired/revoked without inventing connected", () => {
    const now = Date.parse("2026-09-15T12:00:00.000Z");
    assert.equal(
      gatewayConnectionPresentation(
        {
          gateway_id: "p",
          status: "pending",
          pairing_expires_at: "2026-09-15T12:05:00.000Z",
        },
        now
      ),
      "pending"
    );
    assert.equal(
      gatewayConnectionPresentation(
        {
          gateway_id: "e",
          status: "pending",
          pairing_expires_at: "2026-09-15T11:00:00.000Z",
        },
        now
      ),
      "expired"
    );
    assert.equal(
      gatewayConnectionPresentation({ gateway_id: "r", status: "revoked" }, now),
      "revoked"
    );
    assert.equal(
      gatewayConnectionPresentation({ gateway_id: "u", status: "weird" }, now),
      "unknown"
    );
  });
});

describe("normalizeJobStatus", () => {
  it("keeps known statuses and marks others as uncertain (not done)", () => {
    assert.equal(normalizeJobStatus("pending"), "active");
    assert.equal(normalizeJobStatus("queued"), "active");
    assert.equal(normalizeJobStatus("running"), "active");
    assert.equal(normalizeJobStatus("done"), "done");
    assert.equal(normalizeJobStatus("failed"), "failed");
    assert.equal(normalizeJobStatus("mystery"), "uncertain");
    assert.notEqual(normalizeJobStatus("failed"), "done");
    assert.notEqual(normalizeJobStatus("mystery"), "done");
  });
});

describe("applyActivityFetchResult", () => {
  it("distinguishes empty activity from unavailable (failed fetch)", () => {
    assert.deepEqual(applyActivityFetchResult([]), { status: "empty" });
    assert.deepEqual(applyActivityFetchResult(null), {
      status: "unavailable",
    });
    assert.deepEqual(applyActivityFetchResult([{ job_id: "1" }]), {
      status: "ready",
      jobs: [{ job_id: "1" }],
    });
  });
});

describe("applyGatewayListFetchResult", () => {
  it("keeps previous gateways when refresh fails (not an empty list)", () => {
    const previous = [{ gateway_id: "a", status: "paired" }];
    const outcome = applyGatewayListFetchResult(previous, null);
    assert.equal(outcome.ok, false);
    assert.deepEqual(outcome.items, previous);
  });

  it("replaces with fresh list on success", () => {
    const previous = [{ gateway_id: "a", status: "pending" }];
    const fresh = [{ gateway_id: "a", status: "paired" }];
    const outcome = applyGatewayListFetchResult(previous, fresh);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.items[0]?.status, "paired");
  });
});

describe("copyTextToClipboard", () => {
  it("returns true only after a successful write", async () => {
    const ok = await copyTextToClipboard(
      "PAIRING_TOKEN=x\nGATEWAY_KEY=y",
      async () => {
        /* ok */
      }
    );
    assert.equal(ok, true);
  });

  it("returns false when the clipboard write rejects (no false success)", async () => {
    const ok = await copyTextToClipboard("secret", async () => {
      throw new Error("denied");
    });
    assert.equal(ok, false);
  });
});
