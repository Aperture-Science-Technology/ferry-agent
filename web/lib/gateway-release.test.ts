/**
 * Regression: docs download URLs must match CI release asset names exactly.
 * Run: node --experimental-strip-types --test lib/gateway-release.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  gatewayAssetBasename,
  gatewayAssetDownloadUrl,
  gatewayChecksumsDownloadUrl,
  gatewayReleaseTag,
  gatewayReleasesPageUrl,
  normalizeGatewayReleaseVersion,
  resolveGatewayDownloadLinks,
} from "./gateway-release.ts";

describe("normalizeGatewayReleaseVersion", () => {
  it("accepts semver and strips a leading v", () => {
    assert.equal(normalizeGatewayReleaseVersion("1.2.3"), "1.2.3");
    assert.equal(normalizeGatewayReleaseVersion("v1.2.3"), "1.2.3");
    assert.equal(normalizeGatewayReleaseVersion("  v0.9.0-rc.1  "), "0.9.0-rc.1");
  });

  it("rejects empty or invented / non-version strings", () => {
    assert.equal(normalizeGatewayReleaseVersion(""), null);
    assert.equal(normalizeGatewayReleaseVersion(undefined), null);
    assert.equal(normalizeGatewayReleaseVersion("latest"), null);
    assert.equal(normalizeGatewayReleaseVersion("main"), null);
    assert.equal(normalizeGatewayReleaseVersion("ferry-gateway"), null);
  });
});

describe("resolveGatewayDownloadLinks", () => {
  it("returns null when no version is configured (no invented file URL)", () => {
    assert.equal(resolveGatewayDownloadLinks(null), null);
  });

  it("builds the same basenames and download paths as release-gateway-artifacts", () => {
    const links = resolveGatewayDownloadLinks("1.4.0");
    assert.ok(links);
    assert.equal(links.tag, "v1.4.0");
    assert.equal(gatewayReleaseTag("1.4.0"), "v1.4.0");
    assert.equal(
      gatewayAssetBasename("1.4.0", "amd64"),
      "ferry-gateway-1.4.0-amd64.tar.gz"
    );
    assert.equal(
      gatewayAssetBasename("1.4.0", "arm64"),
      "ferry-gateway-1.4.0-arm64.tar.gz"
    );
    assert.equal(
      gatewayAssetDownloadUrl("1.4.0", "amd64"),
      "https://github.com/aperture-science-technology/ferry-agent/releases/download/v1.4.0/ferry-gateway-1.4.0-amd64.tar.gz"
    );
    assert.equal(
      gatewayAssetDownloadUrl("1.4.0", "arm64"),
      "https://github.com/aperture-science-technology/ferry-agent/releases/download/v1.4.0/ferry-gateway-1.4.0-arm64.tar.gz"
    );
    assert.equal(
      gatewayChecksumsDownloadUrl("1.4.0"),
      "https://github.com/aperture-science-technology/ferry-agent/releases/download/v1.4.0/SHA256SUMS"
    );
    assert.deepEqual(
      links.assets.map((a) => a.filename),
      [
        "ferry-gateway-1.4.0-amd64.tar.gz",
        "ferry-gateway-1.4.0-arm64.tar.gz",
      ]
    );
  });

  it("exposes a real releases index URL as the always-safe fallback target", () => {
    assert.equal(
      gatewayReleasesPageUrl(),
      "https://github.com/aperture-science-technology/ferry-agent/releases"
    );
  });
});
