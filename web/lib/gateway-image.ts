/**
 * Gateway Docker image served under /bundle — one archive per architecture,
 * mirrored by deploy/deploy.sh from the latest v* GitHub Release.
 * Single public CTA; the browser picks the archive (see GatewayDownloadButton).
 */

export const GATEWAY_BUNDLE_BASE =
  "https://ferry-agent.aperture-agency.org/bundle";

export const GATEWAY_ARCHS = ["amd64", "arm64"] as const;

export type GatewayArch = (typeof GATEWAY_ARCHS)[number];

/** Server-rendered default: never a dead link, corrected on mount. */
export const GATEWAY_DEFAULT_ARCH: GatewayArch = "amd64";

/** Docker-format, uncompressed: the format the Docker Desktop / OrbStack GUI imports. */
export function gatewayImageFilename(arch: GatewayArch): string {
  return `ferry-agent-gateway-${arch}.tar`;
}

export function gatewayImageUrl(arch: GatewayArch): string {
  return `${GATEWAY_BUNDLE_BASE}/${gatewayImageFilename(arch)}`;
}

export type GatewayArchSignals = {
  /** navigator.userAgent */
  userAgent?: string | null;
  /** navigator.userAgentData.getHighEntropyValues(["architecture"]) → "arm" | "x86" */
  architecture?: string | null;
  /** navigator.platform */
  platform?: string | null;
};

const ARM_ARCHITECTURE_RE = /^arm/i;
const X86_ARCHITECTURE_RE = /^x86|amd64|i[3-6]86/i;
const ARM_USER_AGENT_RE = /aarch64|arm64|armv8|armhf|\barm\b/i;
const APPLE_RE = /macintosh|mac os x|macintel/i;

/**
 * Decision order (first match wins):
 * 1. Chromium `architecture` hint (arm* → arm64, x86* → amd64).
 * 2. ARM token in the user agent (Linux/Windows on ARM) → arm64.
 * 3. Apple platform → arm64: Safari and Firefox freeze their UA to
 *    "Intel Mac OS X" even on Apple Silicon, so the UA is untrustworthy there
 *    and Apple Silicon is the documented default. The guide exposes an
 *    explicit override for the remaining Intel-Mac case.
 * 4. Otherwise → amd64.
 */
export function detectGatewayArch(signals: GatewayArchSignals): GatewayArch {
  const architecture = signals.architecture?.trim() ?? "";
  if (architecture) {
    if (ARM_ARCHITECTURE_RE.test(architecture)) {
      return "arm64";
    }
    if (X86_ARCHITECTURE_RE.test(architecture)) {
      return "amd64";
    }
  }

  const userAgent = signals.userAgent ?? "";
  if (ARM_USER_AGENT_RE.test(userAgent)) {
    return "arm64";
  }

  const platform = signals.platform ?? "";
  if (APPLE_RE.test(platform) || APPLE_RE.test(userAgent)) {
    return "arm64";
  }

  return "amd64";
}
