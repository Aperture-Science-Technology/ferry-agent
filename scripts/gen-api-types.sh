#!/usr/bin/env bash
# Regenerate openapi.json + web/lib/api-types.generated.ts (idempotent).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/web"

if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PY="$ROOT/.venv/bin/python"
else
  PY="${PYTHON:-python3}"
fi

export PYTHONPATH="$ROOT/src${PYTHONPATH:+:$PYTHONPATH}"
"$PY" "$ROOT/scripts/dump_openapi.py" > "$ROOT/openapi.json"

cd "$WEB"
npx openapi-typescript "$ROOT/openapi.json" -o "$WEB/lib/api-types.generated.ts"
