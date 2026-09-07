"""Shared fixtures for ferry-gateway-agent tests."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_TESTS_DIR = Path(__file__).resolve().parent
_AGENT_ROOT = _TESTS_DIR.parent
# ferry_gateway_agent package + local agent_testkit (avoid clashing with repo-root tests/).
for _path in (_AGENT_ROOT, _TESTS_DIR):
    _text = str(_path)
    if _text not in sys.path:
        sys.path.insert(0, _text)

from agent_testkit import (  # noqa: E402
    FakeProwlarr,
    FakeTransmission,
    FakeVirusTotal,
    make_agent,
    make_settings,
)

__all__ = [
    "FakeProwlarr",
    "FakeTransmission",
    "FakeVirusTotal",
    "make_agent",
    "make_settings",
]


@pytest.fixture
def download_root(tmp_path: Path) -> Path:
    root = tmp_path / "downloads"
    root.mkdir()
    return root


@pytest.fixture
def state_path(tmp_path: Path) -> Path:
    path = tmp_path / "state" / "state.json"
    path.parent.mkdir(parents=True)
    return path
