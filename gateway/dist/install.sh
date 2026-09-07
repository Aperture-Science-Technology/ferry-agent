#!/usr/bin/env bash
# Ferry Agent gateway installer (all-in-one image + compose.yaml).
# Expects this script next to compose.yaml. Compatible: bash Linux / macOS / Git Bash.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE="${SCRIPT_DIR}/.env"
COMPOSE_FILE="${SCRIPT_DIR}/compose.yaml"
DEFAULT_PLATFORM_URL="https://ferry-agent.aperture-agency.org"
DEFAULT_IMAGE="ghcr.io/aperture-science-technology/ferry-agent/gateway"

err() { printf '%s\n' "Erreur : $*" >&2; }
info() { printf '%s\n' "$*"; }
die() { err "$*"; exit 1; }

set_env_var() {
  local file="$1" key="$2" value="$3" tmp found=0
  tmp="$(mktemp "${TMPDIR:-/tmp}/ferry-env.XXXXXX")"
  if [[ -f "${file}" ]]; then
    while IFS= read -r line || [[ -n "${line}" ]]; do
      if [[ "${line}" == "${key}="* ]]; then
        printf '%s=%s\n' "${key}" "${value}"
        found=1
      else
        printf '%s\n' "${line}"
      fi
    done < "${file}" > "${tmp}"
  else
    : > "${tmp}"
  fi
  if [[ "${found}" -eq 0 ]]; then
    printf '%s=%s\n' "${key}" "${value}" >> "${tmp}"
  fi
  mv "${tmp}" "${file}"
}

detect_tz() {
  if [[ -n "${TZ:-}" ]]; then
    printf '%s\n' "${TZ}"
    return
  fi
  if [[ -f /etc/timezone ]]; then
    tr -d '[:space:]' < /etc/timezone
    printf '\n'
    return
  fi
  if command -v timedatectl >/dev/null 2>&1; then
    local tz
    tz="$(timedatectl show -p Timezone --value 2>/dev/null || true)"
    if [[ -n "${tz}" ]]; then
      printf '%s\n' "${tz}"
      return
    fi
  fi
  if [[ -L /etc/localtime ]]; then
    local target
    target="$(readlink /etc/localtime 2>/dev/null || true)"
    if [[ "${target}" == *zoneinfo/* ]]; then
      printf '%s\n' "${target#*zoneinfo/}"
      return
    fi
  fi
  printf 'UTC\n'
}

detect_arch() {
  local m
  m="$(uname -m 2>/dev/null || echo unknown)"
  case "${m}" in
    x86_64|amd64) printf 'amd64\n' ;;
    aarch64|arm64) printf 'arm64\n' ;;
    *) printf '%s\n' "${m}" ;;
  esac
}

check_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    die "Docker est introuvable. Installez Docker Desktop / OrbStack / Docker Engine, puis relancez ./install.sh."
  fi
  if ! docker info >/dev/null 2>&1; then
    die "Docker est installé mais ne répond pas. Démarrez le démon Docker, puis relancez ./install.sh."
  fi
  if ! docker compose version >/dev/null 2>&1; then
    die "« docker compose » (v2) est introuvable."
  fi
}

# Load a local docker-format .tar / .tar.gz if present next to this script.
maybe_load_local_image() {
  local arch pattern f
  arch="$(detect_arch)"
  pattern="ferry-gateway-*-${arch}.tar.gz"
  # Prefer exact arch tarball in the current directory.
  # shellcheck disable=SC2086
  for f in ${pattern} ferry-gateway-*-${arch}.tar; do
    if [[ -f "${f}" ]]; then
      info "Chargement de l'image locale : ${f}"
      if ! docker load -i "${f}"; then
        die "Échec de « docker load -i ${f} »."
      fi
      return 0
    fi
  done
  return 0
}

image_present() {
  local tag="${1:-latest}"
  docker image inspect "${DEFAULT_IMAGE}:${tag}" >/dev/null 2>&1
}

ensure_env() {
  if [[ ! -f "${COMPOSE_FILE}" ]]; then
    die "compose.yaml introuvable à côté de install.sh."
  fi

  local pairing_token="" gateway_key="" image_tag="" env_existed=0
  if [[ -f "${ENV_FILE}" ]]; then
    env_existed=1
    # shellcheck disable=SC1090
    set -a; source "${ENV_FILE}"; set +a
    pairing_token="${PAIRING_TOKEN:-}"
    gateway_key="${GATEWAY_KEY:-}"
    image_tag="${GATEWAY_IMAGE_TAG:-}"
    info "Fichier .env déjà présent — conservation des valeurs existantes."
  fi

  if [[ -z "${pairing_token}" ]]; then
    info ""
    info "Configuration initiale"
    info "----------------------"
    info "Collez le token de pairing du dashboard Ferry Agent, puis Entrée."
    printf 'Token de pairing : '
    IFS= read -r pairing_token || true
    [[ -n "${pairing_token}" ]] || die "PAIRING_TOKEN obligatoire."
  fi

  if [[ -z "${gateway_key}" ]]; then
    printf 'Clé gateway (GATEWAY_KEY, affichée au pairing) : '
    IFS= read -r gateway_key || true
    [[ -n "${gateway_key}" ]] || die "GATEWAY_KEY obligatoire au premier démarrage."
  fi

  if [[ -z "${image_tag}" ]]; then
    image_tag="latest"
    local candidates
    candidates="$(docker images --format '{{.Tag}}' "${DEFAULT_IMAGE}" 2>/dev/null | grep -E '^[0-9]+\.[0-9]+' | head -1 || true)"
    if [[ -n "${candidates}" ]]; then
      image_tag="${candidates}"
    fi
  fi

  [[ -f "${ENV_FILE}" ]] || : > "${ENV_FILE}"

  local puid pgid tz download_path
  puid="$(id -u 2>/dev/null || echo 1000)"
  pgid="$(id -g 2>/dev/null || echo 1000)"
  tz="$(detect_tz | tr -d '\r\n')"
  download_path="${DOWNLOAD_PATH:-${SCRIPT_DIR}/downloads}"

  set_env_var "${ENV_FILE}" "PLATFORM_URL" "${PLATFORM_URL:-${DEFAULT_PLATFORM_URL}}"
  set_env_var "${ENV_FILE}" "PAIRING_TOKEN" "${pairing_token}"
  set_env_var "${ENV_FILE}" "GATEWAY_KEY" "${gateway_key}"
  set_env_var "${ENV_FILE}" "GATEWAY_IMAGE_TAG" "${image_tag}"
  if [[ "${env_existed}" -eq 0 ]]; then
    set_env_var "${ENV_FILE}" "PUID" "${puid}"
    set_env_var "${ENV_FILE}" "PGID" "${pgid}"
    set_env_var "${ENV_FILE}" "TZ" "${tz}"
    set_env_var "${ENV_FILE}" "DOWNLOAD_PATH" "${download_path}"
  fi

  mkdir -p "${download_path}"
  info "Fichier .env prêt (tag image : ${image_tag})."
}

start_stack() {
  # shellcheck disable=SC1090
  set -a; source "${ENV_FILE}"; set +a
  local tag="${GATEWAY_IMAGE_TAG:-latest}"

  if ! image_present "${tag}"; then
    info "Image ${DEFAULT_IMAGE}:${tag} absente localement."
    info "Placez ferry-gateway-<version>-$(detect_arch).tar.gz ici et relancez,"
    info "ou : docker pull ${DEFAULT_IMAGE}:${tag}"
    if ! docker pull "${DEFAULT_IMAGE}:${tag}"; then
      die "Impossible d'obtenir l'image. Utilisez docker load depuis la GitHub Release."
    fi
  fi

  info "Démarrage (docker compose up -d)…"
  if ! docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d; then
    die "Échec de docker compose up -d."
  fi
}

print_summary() {
  info ""
  info "========================================"
  info " Gateway prêt"
  info "========================================"
  info "Prowlarr UI : http://127.0.0.1:9696"
  info "Confirmez le pairing sur le dashboard Ferry Agent."
  info ""
}

main() {
  info "Ferry Agent — installation gateway (all-in-one)"
  info ""
  check_docker
  maybe_load_local_image
  ensure_env
  start_stack
  print_summary
}

main "$@"
