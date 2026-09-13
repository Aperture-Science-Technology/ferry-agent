"""Honest health: pairing state without GATEWAY_KEY must not be healthy."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

_HEALTHCHECK = Path(__file__).resolve().parents[2] / "image" / "healthcheck.sh"


def _prepare_bin(tmp_path: Path) -> Path:
    """Fake curl (always OK) + python on PATH so healthcheck.sh can run locally."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    curl = bin_dir / "curl"
    curl.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
    curl.chmod(0o755)
    python = bin_dir / "python"
    if not python.exists():
        python.symlink_to(sys.executable)
    return bin_dir


def _run_healthcheck(tmp_path: Path, state: Path) -> subprocess.CompletedProcess[str]:
    bin_dir = _prepare_bin(tmp_path)
    env = {
        **os.environ,
        "PATH": f"{bin_dir}{os.pathsep}{os.environ.get('PATH', '')}",
        "STATE_PATH": str(state),
        "POLL_INTERVAL_SECONDS": "10",
        "HEARTBEAT_MARGIN_SECONDS": "30",
    }
    return subprocess.run(
        ["sh", str(_HEALTHCHECK)],
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )


def test_healthcheck_script_rejects_missing_gateway_key(tmp_path: Path) -> None:
    """Real healthcheck.sh must fail when state.json has no gateway_key."""
    state = tmp_path / "state" / "state.json"
    state.parent.mkdir(parents=True)
    state.write_text(json.dumps({"gateway_id": "gw-only"}), encoding="utf-8")
    # Fresh heartbeat so failure is specifically the pairing gate, not (c).
    (state.parent / "heartbeat").write_text(f"{time.time()}\n", encoding="utf-8")

    result = _run_healthcheck(tmp_path, state)
    assert result.returncode == 1, (
        f"expected exit 1, got {result.returncode}; stderr={result.stderr!r}"
    )


def test_healthcheck_script_accepts_complete_state_with_fresh_heartbeat(
    tmp_path: Path,
) -> None:
    """Real healthcheck.sh must pass with both secrets and a fresh heartbeat."""
    state = tmp_path / "state" / "state.json"
    state.parent.mkdir(parents=True)
    state.write_text(
        json.dumps({"gateway_id": "gw-1", "gateway_key": "secret"}),
        encoding="utf-8",
    )
    (state.parent / "heartbeat").write_text(f"{time.time()}\n", encoding="utf-8")

    result = _run_healthcheck(tmp_path, state)
    assert result.returncode == 0, (
        f"expected exit 0, got {result.returncode}; stderr={result.stderr!r}"
    )
