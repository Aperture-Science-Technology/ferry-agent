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
PAIR_WAIT_SECONDS="${PAIR_WAIT_SECONDS:-60}"
INSTALL_GUIDE_URL="${DEFAULT_PLATFORM_URL}/docs"
ENV_EXISTED=0

err() { printf '%s\n' "Erreur : $*" >&2; }
info() { printf '%s\n' "$*"; }
die() { err "$*"; exit 1; }

compose() {
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" "$@"
}

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
  local arch f
  local -a matches=()
  arch="$(detect_arch)"
  shopt -s nullglob
  matches=( "ferry-gateway-"*"-${arch}.tar.gz" "ferry-gateway-"*"-${arch}.tar" )
  shopt -u nullglob
  for f in "${matches[@]}"; do
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

  # Idempotent re-run: keep existing .env, never re-prompt secrets.
  if [[ -f "${ENV_FILE}" ]]; then
    ENV_EXISTED=1
    set -a
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
    set +a
    info "Fichier .env déjà présent — conservation des valeurs existantes (pull + up)."
    if [[ -n "${DOWNLOAD_PATH:-}" ]]; then
      mkdir -p "${DOWNLOAD_PATH}"
    fi
    return 0
  fi

  local pairing_token="" gateway_key="" image_tag=""

  if [[ -z "${PAIRING_TOKEN:-}" ]]; then
    info ""
    info "Configuration initiale"
    info "----------------------"
    info "Collez le token de pairing du dashboard Ferry Agent, puis Entrée."
    printf 'Token de pairing : '
    IFS= read -r pairing_token || true
  else
    pairing_token="${PAIRING_TOKEN}"
  fi
  [[ -n "${pairing_token}" ]] || die "PAIRING_TOKEN obligatoire."

  if [[ -z "${GATEWAY_KEY:-}" ]]; then
    printf 'Clé gateway (GATEWAY_KEY, affichée une seule fois dans Ferry Agent) : '
    IFS= read -r gateway_key || true
  else
    gateway_key="${GATEWAY_KEY}"
  fi
  [[ -n "${gateway_key}" ]] || die "GATEWAY_KEY obligatoire au premier démarrage."

  image_tag="${GATEWAY_IMAGE_TAG:-}"
  if [[ -z "${image_tag}" ]]; then
    image_tag="latest"
    local candidates
    candidates="$(docker images --format '{{.Tag}}' "${DEFAULT_IMAGE}" 2>/dev/null | grep -E '^[0-9]+\.[0-9]+' | head -1 || true)"
    if [[ -n "${candidates}" ]]; then
      image_tag="${candidates}"
    fi
  fi

  : > "${ENV_FILE}"

  local puid pgid tz download_path
  puid="$(id -u 2>/dev/null || echo 1000)"
  pgid="$(id -g 2>/dev/null || echo 1000)"
  tz="$(detect_tz | tr -d '\r\n')"
  download_path="${DOWNLOAD_PATH:-${SCRIPT_DIR}/downloads}"

  set_env_var "${ENV_FILE}" "PLATFORM_URL" "${PLATFORM_URL:-${DEFAULT_PLATFORM_URL}}"
  set_env_var "${ENV_FILE}" "PAIRING_TOKEN" "${pairing_token}"
  set_env_var "${ENV_FILE}" "GATEWAY_KEY" "${gateway_key}"
  set_env_var "${ENV_FILE}" "GATEWAY_IMAGE_TAG" "${image_tag}"
  set_env_var "${ENV_FILE}" "PUID" "${puid}"
  set_env_var "${ENV_FILE}" "PGID" "${pgid}"
  set_env_var "${ENV_FILE}" "TZ" "${tz}"
  set_env_var "${ENV_FILE}" "DOWNLOAD_PATH" "${download_path}"

  mkdir -p "${download_path}"
  info "Fichier .env prêt (tag image : ${image_tag})."
}

wait_for_pairing() {
  local elapsed=0
  info "Attente de l'appairage (max ${PAIR_WAIT_SECONDS} s)…"
  while (( elapsed < PAIR_WAIT_SECONDS )); do
    if compose logs --no-color 2>/dev/null | grep -Eq 'Gateway .+ paired'; then
      info "Appairage confirmé (log « Gateway … paired »)."
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done

  err "Appairage non confirmé après ${PAIR_WAIT_SECONDS} s."
  info ""
  info "--- Dernières lignes de log (30) ---"
  compose logs --no-color --tail=30 2>/dev/null || true
  info "------------------------------------"
  die "Vérifiez PAIRING_TOKEN / GATEWAY_KEY / PLATFORM_URL, puis consultez le guide : ${INSTALL_GUIDE_URL}"
}

start_stack() {
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
  local tag="${GATEWAY_IMAGE_TAG:-latest}"

  if ! image_present "${tag}"; then
    info "Image ${DEFAULT_IMAGE}:${tag} absente localement."
    info "Placez ferry-gateway-<version>-$(detect_arch).tar.gz ici et relancez,"
    info "ou : docker pull ${DEFAULT_IMAGE}:${tag}"
    if ! docker pull "${DEFAULT_IMAGE}:${tag}"; then
      die "Impossible d'obtenir l'image. Utilisez docker load depuis la GitHub Release."
    fi
  fi

  if [[ "${ENV_EXISTED}" -eq 1 ]]; then
    info "Mise à jour / démarrage (docker compose pull && up -d)…"
    if ! compose pull; then
      die "Échec de docker compose pull."
    fi
  else
    info "Démarrage (docker compose up -d)…"
  fi
  if ! compose up -d; then
    die "Échec de docker compose up -d."
  fi
  wait_for_pairing
}

print_summary() {
  info ""
  info "========================================"
  info " Gateway prêt (appairé)"
  info "========================================"
  info "Prowlarr UI : http://127.0.0.1:9696"
  info "Statut « paired » visible sur le dashboard Ferry Agent."
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
