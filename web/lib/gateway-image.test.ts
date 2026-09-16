/**
 * Regression: docs must keep the historical single-CTA download URL.
 * Run: node --experimental-strip-types --test lib/gateway-image.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GATEWAY_IMAGE_DOWNLOAD_URL } from "./gateway-image.ts";

describe("GATEWAY_IMAGE_DOWNLOAD_URL", () => {
  it("is the canonical /bundle ferry-agent-gateway.tar URL", () => {
    assert.equal(
      GATEWAY_IMAGE_DOWNLOAD_URL,
      "https://ferry-agent.aperture-agency.org/bundle/ferry-agent-gateway.tar"
    );
  });

  it("does not point at GitHub Releases or per-arch assets", () => {
    assert.equal(GATEWAY_IMAGE_DOWNLOAD_URL.includes("github.com"), false);
    assert.equal(GATEWAY_IMAGE_DOWNLOAD_URL.includes("amd64"), false);
    assert.equal(GATEWAY_IMAGE_DOWNLOAD_URL.includes("arm64"), false);
    assert.equal(GATEWAY_IMAGE_DOWNLOAD_URL.endsWith(".tar.gz"), false);
  });
});
