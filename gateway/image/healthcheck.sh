#!/bin/sh
# Honest container health: Prowlarr up + gateway paired + agent heartbeat fresh.
set -eu

STATE_PATH="${STATE_PATH:-/state/state.json}"
HEARTBEAT_PATH="$(dirname "${STATE_PATH}")/heartbeat"
# Default matches ferry_gateway_agent.config.Settings.poll_interval_seconds.
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-10}"
# Physical margin: Docker HEALTHCHECK --interval (30s). Covers check jitter,
# brief scheduling delay before the next run_once write, and mtime granularity.
HEARTBEAT_MARGIN_SECONDS="${HEARTBEAT_MARGIN_SECONDS:-30}"

# (a) Prowlarr is responding.
curl -sf http://127.0.0.1:9696/ping >/dev/null || exit 1

# (b) Pairing state is present (JSON parse — not a grep).
STATE_PATH="${STATE_PATH}" python - <<'PY' || exit 1
import json
import os
import sys
from pathlib import Path

path = Path(os.environ["STATE_PATH"])
if not path.is_file():
    sys.exit(1)
try:
    data = json.loads(path.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError):
    sys.exit(1)
if not isinstance(data, dict):
    sys.exit(1)
if not data.get("gateway_id") or not data.get("gateway_key"):
    sys.exit(1)
PY

# (c) Heartbeat fresher than 3 * POLL_INTERVAL_SECONDS + margin.
HEARTBEAT_PATH="${HEARTBEAT_PATH}" \
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS}" \
HEARTBEAT_MARGIN_SECONDS="${HEARTBEAT_MARGIN_SECONDS}" \
python - <<'PY' || exit 1
import os
import sys
import time
from pathlib import Path

path = Path(os.environ["HEARTBEAT_PATH"])
if not path.is_file():
    sys.exit(1)
try:
    stamp = float(path.read_text(encoding="utf-8").strip().splitlines()[0])
except (OSError, ValueError, IndexError):
    sys.exit(1)

poll = float(os.environ.get("POLL_INTERVAL_SECONDS", "10"))
margin = float(os.environ.get("HEARTBEAT_MARGIN_SECONDS", "30"))
max_age = 3.0 * poll + margin
if (time.time() - stamp) > max_age:
    sys.exit(1)
PY

exit 0
