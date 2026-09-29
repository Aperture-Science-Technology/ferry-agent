#!/usr/bin/env bash
# Deploy ferry-agent stack and publish /bundle gateway image archives
# (one uncompressed docker-format .tar per arch) from the latest v* GitHub Release.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

DEPLOY_ROOT="${DEPLOY_ROOT:-/home/glados/deployments/ferry-agent}"
DIST_DIR="${DEPLOY_ROOT}/dist"
REPO="${GITHUB_REPOSITORY:-aperture-science-technology/ferry-agent}"
API_BASE="https://api.github.com/repos/${REPO}"

set -a
# shellcheck disable=SC1091
source "${DEPLOY_ROOT}/.env"
set +a

# Guarantee the nginx :ro volume source exists before compose up.
mkdir -p "${DIST_DIR}"

resolve_release_tag() {
  local tag=""
  if command -v gh >/dev/null 2>&1; then
    tag="$(gh release list --repo "${REPO}" --limit 20 2>/dev/null \
      | awk -F'\t' '$3 ~ /^v/ { print $3; exit }' || true)"
  fi
  if [[ -z "${tag}" ]]; then
    tag="$(curl -fsSL "${API_BASE}/releases" \
      | python3 -c 'import json,sys
rels=json.load(sys.stdin)
for r in rels:
  t=r.get("tag_name") or ""
  if t.startswith("v") and not r.get("draft") and not r.get("prerelease"):
    print(t); break' 2>/dev/null || true)"
  fi
  printf '%s' "${tag}"
}

download_release_asset() {
  local tag="$1" name="$2" dest="$3"
  local url
  url="$(curl -fsSL "${API_BASE}/releases/tags/${tag}" \
    | python3 -c 'import json,sys
rel=json.load(sys.stdin)
want=sys.argv[1]
for a in rel.get("assets") or []:
  if a.get("name")==want:
    print(a.get("browser_download_url") or ""); break' "${name}")"
  if [[ -z "${url}" ]]; then
    printf 'warn: asset %s missing on release %s — skip\n' "${name}" "${tag}" >&2
    return 1
  fi
  curl -fsSL -o "${dest}.tmp" "${url}"
  mv "${dest}.tmp" "${dest}"
  printf 'synced %s <- %s/%s\n' "${dest}" "${tag}" "${name}"
}

# Seed operator filets from the deployed tree (C2b/C3 templates + README).
install -m 0644 "${ROOT}/gateway/dist/README.md" "${DIST_DIR}/README.md"
install -m 0644 "${ROOT}/gateway/dist/ferry-gateway.command.tmpl" \
  "${DIST_DIR}/ferry-gateway.command.tmpl"
install -m 0644 "${ROOT}/gateway/dist/ferry-gateway.bat.tmpl" \
  "${DIST_DIR}/ferry-gateway.bat.tmpl"
install -m 0644 "${ROOT}/gateway/dist/compose.yaml" "${DIST_DIR}/compose.yaml"
install -m 0755 "${ROOT}/gateway/dist/install.sh" "${DIST_DIR}/install.sh"

# Overlay release-published text assets (compose/install + integrity files).
RELEASE_TAG="$(resolve_release_tag)"
if [[ -n "${RELEASE_TAG}" ]]; then
  download_release_asset "${RELEASE_TAG}" "compose.yaml" "${DIST_DIR}/compose.yaml" \
    || true
  if download_release_asset "${RELEASE_TAG}" "install.sh" "${DIST_DIR}/install.sh"; then
    chmod 0755 "${DIST_DIR}/install.sh"
  fi
  download_release_asset "${RELEASE_TAG}" "SHA256SUMS" "${DIST_DIR}/SHA256SUMS" \
    || true
  download_release_asset "${RELEASE_TAG}" "SHA256SUMS.sig" "${DIST_DIR}/SHA256SUMS.sig" \
    || true
else
  printf 'warn: no v* GitHub Release found — /bundle uses gateway/dist/ only\n' >&2
fi

# Gateway image archives served under /bundle. The public guide has ONE button;
# the browser picks the arch, so BOTH docker-format archives must be present as
# uncompressed .tar (the format the Docker Desktop / OrbStack GUI imports).
CACHE_DIR="${DEPLOY_ROOT}/cache"
mkdir -p "${CACHE_DIR}"

gateway_archive_sha() {
  local arch="$1" version="$2" line
  line="$(grep -E "  ferry-gateway-${version}-${arch}[.]tar[.]gz$" "${DIST_DIR}/SHA256SUMS" 2>/dev/null | head -1 || true)"
  printf '%s' "${line%% *}"
}

install_gateway_archive() {
  local arch="$1" version="$2"
  local gz="${CACHE_DIR}/ferry-gateway-${version}-${arch}.tar.gz"
  local tar="${DIST_DIR}/ferry-agent-gateway-${arch}.tar"
  local want have installed
  installed="$(cat "${CACHE_DIR}/${arch}.installed" 2>/dev/null || true)"
  want="$(gateway_archive_sha "${arch}" "${version}")"
  if [[ -z "${want}" ]]; then
    printf 'warn: no checksum for %s %s — keeping the existing archive\n' "${arch}" "${version}" >&2
    return 0
  fi
  if [[ "${want}" == "${installed}" && -s "${tar}" ]]; then
    printf 'kept %s (sha %s already installed)\n' "${tar}" "${want:0:12}"
    return 0
  fi
  if ! download_release_asset "${RELEASE_TAG}" \
    "ferry-gateway-${version}-${arch}.tar.gz" "${gz}"; then
    printf 'warn: %s archive unavailable — keeping the existing file\n' "${arch}" >&2
    return 0
  fi
  have="$(sha256sum "${gz}" | awk '{print $1}')"
  if [[ "${have}" != "${want}" ]]; then
    printf 'error: %s checksum mismatch (want %s, got %s)\n' "${arch}" "${want}" "${have}" >&2
    rm -f "${gz}"
    return 0
  fi
  gzip -dc "${gz}" > "${tar}.tmp"
  mv "${tar}.tmp" "${tar}"
  printf '%s\n' "${want}" > "${CACHE_DIR}/${arch}.installed"
  rm -f "${gz}"
  printf 'installed %s (%s)\n' "${tar}" "$(du -h "${tar}" | cut -f1)"
}

if [[ -n "${RELEASE_TAG}" ]]; then
  GATEWAY_VERSION="${RELEASE_TAG#v}"
  install_gateway_archive amd64 "${GATEWAY_VERSION}"
  install_gateway_archive arm64 "${GATEWAY_VERSION}"
else
  printf 'warn: no v* GitHub Release — /bundle gateway archives untouched\n' >&2
fi

# Purge ghost and obsolete archives that no longer match the /bundle contract.
rm -f "${DIST_DIR}/ferry-agent-bundle.tar.gz" \
      "${DIST_DIR}/ferry-agent-gateway.tar" \
      "${DIST_DIR}/ferry-agent-gateway.tar.gz" \
      "${DIST_DIR}/ferry-agent-gateway-arm64-fixed.tar"
rm -f "${DIST_DIR}"/ferry-gateway-*.tar \
      "${DIST_DIR}"/ferry-gateway-*.tar.gz

COMPOSE=(docker compose -f deploy/docker-compose.yml)

# Re-run volume ownership every deploy: compose will not recreate a completed
# restart:no one-shot unless forced, and named volumes stay root:root until
# chown. In-place fix for UID/GID 10001 — never wipe ferry_library/ferry_tmp.
"${COMPOSE[@]}" run --rm --no-deps volume-init

"${COMPOSE[@]}" up -d
