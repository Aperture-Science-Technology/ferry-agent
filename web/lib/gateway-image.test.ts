/**
 * Regression: docs CTA must resolve per-arch /bundle .tar URLs (never a dead
 * single archive, never GitHub Release assets).
 * Run: node --experimental-strip-types --test lib/gateway-image.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GATEWAY_DEFAULT_ARCH,
  detectGatewayArch,
  gatewayImageFilename,
  gatewayImageUrl,
} from "./gateway-image.ts";

describe("gatewayImageUrl", () => {
  it("is the canonical /bundle ferry-agent-gateway-amd64.tar URL", () => {
    assert.equal(
      gatewayImageUrl("amd64"),
      "https://ferry-agent.aperture-agency.org/bundle/ferry-agent-gateway-amd64.tar"
    );
  });

  it("is the canonical /bundle ferry-agent-gateway-arm64.tar URL", () => {
    assert.equal(
      gatewayImageUrl("arm64"),
      "https://ferry-agent.aperture-agency.org/bundle/ferry-agent-gateway-arm64.tar"
    );
  });

  it("does not point at GitHub Releases or compressed assets", () => {
    for (const arch of ["amd64", "arm64"] as const) {
      const url = gatewayImageUrl(arch);
      assert.equal(url.includes("github.com"), false);
      assert.equal(url.includes(".tar.gz"), false);
      assert.equal(url.endsWith(".tar"), true);
    }
  });
});

describe("gatewayImageFilename", () => {
  it("names the arm64 docker-format archive", () => {
    assert.equal(gatewayImageFilename("arm64"), "ferry-agent-gateway-arm64.tar");
  });
});

describe("GATEWAY_DEFAULT_ARCH", () => {
  it("is amd64 so SSR never emits a dead link", () => {
    assert.equal(GATEWAY_DEFAULT_ARCH, "amd64");
  });
});

describe("detectGatewayArch", () => {
  it("uses Chromium architecture hint arm → arm64", () => {
    assert.equal(detectGatewayArch({ architecture: "arm" }), "arm64");
  });

  it("uses Chromium architecture hint x86 → amd64", () => {
    assert.equal(detectGatewayArch({ architecture: "x86" }), "amd64");
  });

  it("detects Linux aarch64 from the user agent", () => {
    assert.equal(
      detectGatewayArch({
        userAgent: "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36",
      }),
      "arm64"
    );
  });

  it("detects Windows x64 from the user agent", () => {
    assert.equal(
      detectGatewayArch({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      }),
      "amd64"
    );
  });

  it("detects Linux x86_64 from the user agent", () => {
    assert.equal(
      detectGatewayArch({
        userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      }),
      "amd64"
    );
  });

  it("defaults Apple platforms to arm64 (frozen Intel UA)", () => {
    assert.equal(
      detectGatewayArch({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
        platform: "MacIntel",
      }),
      "arm64"
    );
  });

  it("lets architecture hint override the Apple Silicon default", () => {
    assert.equal(
      detectGatewayArch({
        architecture: "x86",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        platform: "MacIntel",
      }),
      "amd64"
    );
  });

  it("falls back to amd64 with empty signals", () => {
    assert.equal(detectGatewayArch({}), "amd64");
  });
});
