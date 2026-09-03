#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source /home/glados/deployments/ferry-agent/.env; set +a
docker compose -f deploy/docker-compose.yml up -d
