#!/bin/sh
# Wait until Transmission RPC and Prowlarr /ping answer, then start the agent.
set -eu

TRANSMISSION_RPC="${TRANSMISSION_URL:-http://127.0.0.1:9091}/transmission/rpc"
PROWLARR_PING="${PROWLARR_URL:-http://127.0.0.1:9696}/ping"
MAX_TRIES="${READY_TIMEOUT_TRIES:-90}"
SLEEP_SECS="${READY_POLL_SECONDS:-2}"

http_code() {
  url="$1"
  curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 --max-time 5 "${url}" || printf '000'
}

wait_for_transmission() {
  printf 'Waiting for Transmission RPC at %s\n' "${TRANSMISSION_RPC}"
  i=0
  while [ "${i}" -lt "${MAX_TRIES}" ]; do
    code="$(http_code "${TRANSMISSION_RPC}")"
    # 409 = CSRF session handshake (ready), 401 = auth required (ready), 200 = ready
    case "${code}" in
      200|401|409)
        printf 'Transmission is ready (HTTP %s).\n' "${code}"
        return 0
        ;;
    esac
    i=$((i + 1))
    if [ $((i % 5)) -eq 0 ]; then
      printf '  still waiting for Transmission (HTTP %s, try %s/%s)\n' "${code}" "${i}" "${MAX_TRIES}"
    fi
    sleep "${SLEEP_SECS}"
  done
  printf 'Transmission did not become ready in time.\n' >&2
  return 1
}

wait_for_prowlarr() {
  printf 'Waiting for Prowlarr at %s\n' "${PROWLARR_PING}"
  i=0
  while [ "${i}" -lt "${MAX_TRIES}" ]; do
    if curl -sf --connect-timeout 2 --max-time 5 "${PROWLARR_PING}" >/dev/null; then
      printf 'Prowlarr is ready.\n'
      return 0
    fi
    i=$((i + 1))
    if [ $((i % 5)) -eq 0 ]; then
      printf '  still waiting for Prowlarr (try %s/%s)\n' "${i}" "${MAX_TRIES}"
    fi
    sleep "${SLEEP_SECS}"
  done
  printf 'Prowlarr did not become ready in time.\n' >&2
  return 1
}

wait_for_transmission
wait_for_prowlarr

printf 'Starting ferry-gateway-agent.\n'
exec python -m ferry_gateway_agent.worker
