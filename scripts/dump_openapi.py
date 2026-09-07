#!/usr/bin/env python3
"""Dump the FastAPI OpenAPI schema as stable, sorted JSON (no server start)."""

from __future__ import annotations

import json
import sys

from ferry_agent.main import app


def main() -> None:
    json.dump(app.openapi(), sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
