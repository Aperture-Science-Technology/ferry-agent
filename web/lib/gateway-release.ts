/**
 * Gateway install artefacts — must match CI release-gateway-artifacts
 * (.github/workflows/ci.yml) and gateway/dist/README.md.
 *
 * Assets are GitHub Release files only (never a forgotten /bundle tarball).
 * Format: docker (`type=docker`), one arch per file; import via GUI or
 * `docker load -i ferry-gateway-<version>-<arch>.tar.gz`.
 */

export const GATEWAY_GITHUB_OWNER = "aperture-science-technology";
export const GATEWAY_GITHUB_REPO = "ferry-agent";
export const GATEWAY_ARCHS = ["amd64", "arm64"] as const;

export type GatewayArch = (typeof GATEWAY_ARCHS)[number];

const VERSION_RE = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;

/** Strip optional leading `v`; return null if not a release version. */
export function normalizeGatewayReleaseVersion(
  raw: string | undefined | null
): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const version = trimmed.startsWith("v") ? trimmed.slice(1) : trimmed;
  return VERSION_RE.test(version) ? version : null;
}

export function gatewayReleaseTag(version: string): string {
  return `v${version}`;
}

export function gatewayAssetBasename(version: string, arch: GatewayArch): string {
  return `ferry-gateway-${version}-${arch}.tar.gz`;
}

export function gatewayChecksumsBasename(): string {
  return "SHA256SUMS";
}

function releaseDownloadBase(version: string): string {
  const tag = gatewayReleaseTag(version);
  return `https://github.com/${GATEWAY_GITHUB_OWNER}/${GATEWAY_GITHUB_REPO}/releases/download/${tag}`;
}

/** Exact URL CI publishes for a per-arch docker-format tarball. */
export function gatewayAssetDownloadUrl(
  version: string,
  arch: GatewayArch
): string {
  return `${releaseDownloadBase(version)}/${gatewayAssetBasename(version, arch)}`;
}

export function gatewayChecksumsDownloadUrl(version: string): string {
  return `${releaseDownloadBase(version)}/${gatewayChecksumsBasename()}`;
}

/** Always-valid index page (may be empty until the first v* tag release). */
export function gatewayReleasesPageUrl(): string {
  return `https://github.com/${GATEWAY_GITHUB_OWNER}/${GATEWAY_GITHUB_REPO}/releases`;
}

/**
 * Version baked in at build time. Empty / invalid → no asset URLs
 * (UI must show the releases-page fallback, never invent a file URL).
 */
export function getConfiguredGatewayReleaseVersion(): string | null {
  return normalizeGatewayReleaseVersion(
    process.env.NEXT_PUBLIC_GATEWAY_RELEASE_VERSION
  );
}

export type GatewayDownloadLinks = {
  version: string;
  tag: string;
  checksumsUrl: string;
  assets: { arch: GatewayArch; filename: string; url: string }[];
};

export function resolveGatewayDownloadLinks(
  version: string | null
): GatewayDownloadLinks | null {
  if (!version) return null;
  return {
    version,
    tag: gatewayReleaseTag(version),
    checksumsUrl: gatewayChecksumsDownloadUrl(version),
    assets: GATEWAY_ARCHS.map((arch) => ({
      arch,
      filename: gatewayAssetBasename(version, arch),
      url: gatewayAssetDownloadUrl(version, arch),
    })),
  };
}
