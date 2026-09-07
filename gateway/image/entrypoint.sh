#!/bin/sh
# Prepare volumes/config, then exec supervisord (or print help/version).
set -eu

APP_USER="abc"
CONFIG_ROOT="/config"
PROWLARR_DATA="${CONFIG_ROOT}/prowlarr"
TRANSMISSION_DATA="${CONFIG_ROOT}/transmission"
DOWNLOAD_PATH="${DOWNLOAD_PATH:-/downloads}"
STATE_PATH="${STATE_PATH:-/state/state.json}"
PLATFORM_URL="${PLATFORM_URL:-https://ferry-agent.aperture-agency.org}"
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
TZ="${TZ:-UTC}"

# All-in-one: ignore compose-style DNS names from a copied .env.
export PROWLARR_URL="http://127.0.0.1:9696"
export TRANSMISSION_URL="http://127.0.0.1:9091"
export DOWNLOAD_PATH
export STATE_PATH
export PLATFORM_URL
export TZ

print_help() {
  cat <<'EOF'
Ferry Agent all-in-one gateway
  transmission-daemon + Prowlarr + gateway-agent in one container.

Usage:
  docker run --rm gateway:test --help
  docker run --rm gateway:test --version
  docker run -d --name ferry-gateway --restart unless-stopped -e PAIRING_TOKEN=YOUR_TOKEN -e GATEWAY_KEY=YOUR_KEY -e PUID=$(id -u) -e PGID=$(id -g) -p 127.0.0.1:9696:9696 -p 51413:51413 -p 51413:51413/udp -v "$PWD/downloads:/downloads" -v ferry-gw-config:/config -v ferry-gw-state:/state gateway:test

Required at first start:
  PAIRING_TOKEN     one-time token from the Ferry Agent dashboard
  GATEWAY_KEY       gateway key shown at pairing (required by the agent)

Optional:
  PLATFORM_URL      default https://ferry-agent.aperture-agency.org
  PROWLARR_API_KEY  generated and persisted in /config if omitted
  TRANSMISSION_USER / TRANSMISSION_PASSWORD
                    optional; if omitted, user=ferry + random password
                    persisted in /config/transmission-rpc-password
  DOWNLOAD_PATH     in-container path, default /downloads
  PUID / PGID / TZ  default 1000 / 1000 / UTC
  GATEWAY_ID        reused after pairing via /state/state.json

Ports:
  9696              Prowlarr UI (admin: indexer credentials). Default to
                    localhost only: -p 127.0.0.1:9696:9696
                    Publishing 9696 on 0.0.0.0 exposes that admin UI on
                    your LAN — Forms auth is enabled; credentials are in
                    /config/prowlarr-credentials (user=ferry).
  51413/tcp+udp     Transmission peer
  9091              Transmission RPC is local to the process only
                    (bound to 127.0.0.1). Do not publish unless you
                    need the WebUI, then use:
                      -p 127.0.0.1:9091:9091
                    Credentials: /config/transmission-rpc-password

Volumes:
  /config           Prowlarr + Transmission settings
  /downloads        torrent data
  /state            agent pairing state
EOF
}

print_version() {
  agent_version="unknown"
  if command -v python >/dev/null 2>&1; then
    agent_version="$(python -c 'from ferry_gateway_agent import __version__; print(__version__)' 2>/dev/null || printf 'unknown')"
  fi
  prowlarr_version="unknown"
  if [ -f /opt/Prowlarr/VERSION ]; then
    prowlarr_version="$(tr -d '\r\n' < /opt/Prowlarr/VERSION)"
  fi
  transmission_version="unknown"
  if command -v transmission-daemon >/dev/null 2>&1; then
    transmission_version="$(transmission-daemon --version 2>&1 | tr -d '\r' | head -n 1 || true)"
  fi
  printf 'ferry-gateway-agent %s\n' "${agent_version}"
  printf 'Prowlarr %s\n' "${prowlarr_version}"
  printf '%s\n' "${transmission_version:-transmission-daemon}"
}

case "${1:-}" in
  --help|-h|help)
    print_help
    exit 0
    ;;
  --version|-v|version)
    print_version
    exit 0
    ;;
esac

apply_timezone() {
  if [ -e "/usr/share/zoneinfo/${TZ}" ]; then
    ln -snf "/usr/share/zoneinfo/${TZ}" /etc/localtime
    printf '%s\n' "${TZ}" > /etc/timezone
  fi
}

apply_user() {
  if [ "${PUID}" = "0" ]; then
    APP_USER="root"
    export APP_USER
    return
  fi
  if ! getent group abc >/dev/null; then
    groupadd -o -g "${PGID}" abc
  elif [ "$(getent group abc | cut -d: -f3)" != "${PGID}" ]; then
    groupmod -o -g "${PGID}" abc
  fi
  if ! getent passwd abc >/dev/null; then
    useradd --create-home --uid "${PUID}" --gid abc --shell /usr/sbin/nologin abc
  else
    current_uid="$(id -u abc)"
    current_gid="$(id -g abc)"
    if [ "${current_uid}" != "${PUID}" ] || [ "${current_gid}" != "${PGID}" ]; then
      usermod -o -u "${PUID}" -g abc abc
    fi
  fi
  APP_USER="abc"
  export APP_USER
}

ensure_dirs() {
  mkdir -p "${PROWLARR_DATA}" "${TRANSMISSION_DATA}" "${DOWNLOAD_PATH}" \
    "$(dirname "${STATE_PATH}")" /tmp
}

generate_api_key() {
  python - <<'PY'
import secrets
print(secrets.token_hex(16), end="")
PY
}

read_prowlarr_api_key_from_xml() {
  python - <<'PY'
from pathlib import Path
import re
import sys
path = Path("/config/prowlarr/config.xml")
if not path.is_file():
    sys.exit(1)
text = path.read_text(encoding="utf-8")
match = re.search(r"<ApiKey>([^<]+)</ApiKey>", text)
if not match or not match.group(1).strip():
    sys.exit(1)
print(match.group(1).strip(), end="")
PY
}

write_prowlarr_config() {
  api_key="$1"
  python - "${api_key}" <<'PY'
from pathlib import Path
import re
import sys

api_key = sys.argv[1]
path = Path("/config/prowlarr/config.xml")
path.parent.mkdir(parents=True, exist_ok=True)
template = """<?xml version="1.0" encoding="utf-8"?>
<Config>
  <BindAddress>*</BindAddress>
  <Port>9696</Port>
  <SslPort>9697</SslPort>
  <EnableSsl>False</EnableSsl>
  <LaunchBrowser>False</LaunchBrowser>
  <ApiKey>__API_KEY__</ApiKey>
  <AuthenticationMethod>Forms</AuthenticationMethod>
  <AuthenticationRequired>Enabled</AuthenticationRequired>
  <Branch>master</Branch>
  <LogLevel>info</LogLevel>
  <SslCertPath></SslCertPath>
  <SslCertPassword></SslCertPassword>
  <UrlBase></UrlBase>
  <InstanceName>Prowlarr</InstanceName>
  <UpdateAutomatically>False</UpdateAutomatically>
  <UpdateMechanism>BuiltIn</UpdateMechanism>
  <UpdateScriptPath></UpdateScriptPath>
  <AnalyticsEnabled>False</AnalyticsEnabled>
  <Theme>auto</Theme>
</Config>
"""


def set_tag(text: str, tag: str, value: str) -> str:
    pattern = rf"<{tag}>[^<]*</{tag}>"
    replacement = f"<{tag}>{value}</{tag}>"
    if re.search(pattern, text):
        return re.sub(pattern, replacement, text, count=1)
    return text.replace("</Config>", f"  {replacement}\n</Config>", 1)


if path.is_file():
    text = path.read_text(encoding="utf-8")
    text = set_tag(text, "ApiKey", api_key)
    text = set_tag(text, "AuthenticationMethod", "Forms")
    text = set_tag(text, "AuthenticationRequired", "Enabled")
    path.write_text(text, encoding="utf-8")
else:
    path.write_text(template.replace("__API_KEY__", api_key), encoding="utf-8")
PY
}

ensure_prowlarr_api_key() {
  key="${PROWLARR_API_KEY:-}"
  if [ -z "${key}" ] && [ -f "${CONFIG_ROOT}/prowlarr-api-key" ]; then
    key="$(tr -d '\r\n' < "${CONFIG_ROOT}/prowlarr-api-key")"
  fi
  if [ -z "${key}" ]; then
    key="$(read_prowlarr_api_key_from_xml || true)"
  fi
  if [ -z "${key}" ]; then
    key="$(generate_api_key)"
    printf 'Generated PROWLARR_API_KEY and stored it under /config.\n'
  fi
  printf '%s\n' "${key}" > "${CONFIG_ROOT}/prowlarr-api-key"
  write_prowlarr_config "${key}"
  export PROWLARR_API_KEY="${key}"
}

generate_transmission_password() {
  python - <<'PY'
import secrets
print(secrets.token_urlsafe(24), end="")
PY
}

ensure_transmission_credentials() {
  user="${TRANSMISSION_USER:-}"
  password="${TRANSMISSION_PASSWORD:-}"
  pass_file="${CONFIG_ROOT}/transmission-rpc-password"

  if [ -n "${user}" ] && [ -z "${password}" ]; then
    printf '%s\n' "TRANSMISSION_USER and TRANSMISSION_PASSWORD must be set together" >&2
    exit 1
  fi
  if [ -z "${user}" ] && [ -n "${password}" ]; then
    printf '%s\n' "TRANSMISSION_USER and TRANSMISSION_PASSWORD must be set together" >&2
    exit 1
  fi

  if [ -z "${user}" ] && [ -z "${password}" ] && [ -f "${pass_file}" ]; then
    password="$(tr -d '\r\n' < "${pass_file}")"
    user="ferry"
  fi

  if [ -z "${user}" ] || [ -z "${password}" ]; then
    user="ferry"
    password="$(generate_transmission_password)"
    printf 'Transmission RPC credentials generated (user=ferry). Stored in /config/transmission-rpc-password.\n'
  fi

  printf '%s\n' "${password}" > "${pass_file}"
  chmod 600 "${pass_file}"
  export TRANSMISSION_USER="${user}"
  export TRANSMISSION_PASSWORD="${password}"
}

ensure_prowlarr_credentials() {
  creds_file="${CONFIG_ROOT}/prowlarr-credentials"
  if [ -f "${creds_file}" ]; then
    chmod 600 "${creds_file}" || true
    return
  fi
  password="$(
    python - <<'PY'
import secrets
print(secrets.token_urlsafe(24), end="")
PY
  )"
  umask 077
  printf 'username=ferry\npassword=%s\n' "${password}" > "${creds_file}"
  chmod 600 "${creds_file}"
  printf 'Generated Prowlarr UI credentials and stored them under /config.\n'
  printf 'Prowlarr UI: http://127.0.0.1:9696 — user=ferry, password stored in /config/prowlarr-credentials\n'
}

write_transmission_settings() {
  python - <<'PY'
import json
import os
import sys
from pathlib import Path

path = Path("/config/transmission/settings.json")
path.parent.mkdir(parents=True, exist_ok=True)
settings = {}
if path.is_file():
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(loaded, dict):
            settings = loaded
    except json.JSONDecodeError:
        settings = {}

download = os.environ.get("DOWNLOAD_PATH", "/downloads")
user = os.environ.get("TRANSMISSION_USER") or ""
password = os.environ.get("TRANSMISSION_PASSWORD") or ""
if not user or not password:
    print(
        "TRANSMISSION_USER and TRANSMISSION_PASSWORD must be set before writing settings",
        file=sys.stderr,
    )
    sys.exit(1)

settings["download-dir"] = download
settings["incomplete-dir"] = str(Path(download) / "incomplete")
settings["incomplete-dir-enabled"] = False
settings["rpc-enabled"] = True
settings["rpc-bind-address"] = "127.0.0.1"
settings["rpc-port"] = 9091
settings["rpc-url"] = "/transmission/"
settings["rpc-whitelist-enabled"] = True
settings["rpc-whitelist"] = "127.0.0.1"
settings["rpc-host-whitelist-enabled"] = False
settings["rpc-authentication-required"] = True
settings["rpc-username"] = user
settings["rpc-password"] = password
settings["peer-port"] = 51413
settings["peer-port-random-on-start"] = False
settings["port-forwarding-enabled"] = True
settings["umask"] = 18
settings["rename-partial-files"] = True
settings["start-added-torrents"] = True
settings["trash-original-torrent-files"] = False

path.write_text(json.dumps(settings, indent=2) + "\n", encoding="utf-8")
PY
}

has_saved_pairing() {
  python - <<'PY'
import json
import os
import sys
from pathlib import Path

path = Path(os.environ.get("STATE_PATH", "/state/state.json"))
if not path.is_file():
    sys.exit(1)
try:
    data = json.loads(path.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError):
    sys.exit(1)
if isinstance(data, dict) and data.get("gateway_id") and data.get("gateway_key"):
    sys.exit(0)
sys.exit(1)
PY
}

require_pairing_env() {
  if has_saved_pairing; then
    return
  fi
  if [ -n "${GATEWAY_ID:-}" ] && [ -n "${GATEWAY_KEY:-}" ]; then
    return
  fi
  if [ -n "${PAIRING_TOKEN:-}" ] && [ -n "${GATEWAY_KEY:-}" ]; then
    return
  fi

  # PAIRING_TOKEN alone (missing GATEWAY_KEY) — refuse before supervisord starts.
  if [ -n "${PAIRING_TOKEN:-}" ] && [ -z "${GATEWAY_KEY:-}" ]; then
    printf '%s\n' "GATEWAY_KEY must accompany PAIRING_TOKEN on first start (PAIRING_TOKEN alone is not enough). Or restore /state from a previous pairing. See: docker run --rm gateway:test --help" >&2
    exit 1
  fi

  # GATEWAY_KEY alone (missing PAIRING_TOKEN / GATEWAY_ID).
  if [ -n "${GATEWAY_KEY:-}" ] && [ -z "${PAIRING_TOKEN:-}" ]; then
    printf '%s\n' "PAIRING_TOKEN must accompany GATEWAY_KEY on first start (GATEWAY_KEY alone is not enough; or set both GATEWAY_ID and GATEWAY_KEY, or restore /state). See: docker run --rm gateway:test --help" >&2
    exit 1
  fi

  printf '%s\n' "PAIRING_TOKEN and GATEWAY_KEY are required for the first start (or set GATEWAY_ID and GATEWAY_KEY, or restore /state from a previous pairing). See: docker run --rm gateway:test --help" >&2
  exit 1
}

drop_privileges() {
  if [ "${APP_USER}" = "root" ] || [ "$(id -u)" != "0" ]; then
    exec "$@"
  fi
  uid="$(id -u "${APP_USER}")"
  gid="$(id -g "${APP_USER}")"
  exec setpriv --reuid="${uid}" --regid="${gid}" --init-groups "$@"
}

apply_timezone
apply_user
ensure_dirs
require_pairing_env
ensure_prowlarr_api_key
ensure_transmission_credentials
ensure_prowlarr_credentials
write_transmission_settings
chown -R "${APP_USER}:${APP_USER}" "${CONFIG_ROOT}" "${DOWNLOAD_PATH}" "$(dirname "${STATE_PATH}")"

printf 'Starting Ferry Agent gateway (Prowlarr UI :9696 localhost-bound recommended, peer :51413).\n'

# supervisord stays root so child logs can attach to stdout; programs run as APP_USER.
# TRANSMISSION_USER / TRANSMISSION_PASSWORD are already exported for the agent.
if [ "${1:-run}" = "run" ]; then
  exec supervisord -c /etc/supervisor/supervisord.conf
fi

drop_privileges "$@"
