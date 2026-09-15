"""FA-FUNC-SETTINGS-01 : quota sur les chemins d'ecriture bibliotheque
(connecteur + gateway), au-dela de l'upload deja couvert par W-29.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from ferry_agent.models import GatewayJob, GatewayJobStatus, GatewayJobType, PairingStatus
from ferry_agent.services import library
from ferry_agent.services.errors import QUOTA_EXCEEDED_MESSAGE, QuotaExceededError
from tests.fakes import FakeSession
from tests.test_gateways import make_gateway


_USER_ID = uuid.uuid4()


class _FakeConnector:
    name = "gutenberg"

    def __init__(self, fetched_path: str) -> None:
        self._fetched_path = fetched_path

    async def search(self, query: str) -> list:
        return []

    async def fetch(self, result_id: str) -> str:
        return self._fetched_path


def _settings(storage_dir: Path, *, quota: int) -> SimpleNamespace:
    return SimpleNamespace(
        library_storage_dir=str(storage_dir),
        user_storage_quota_bytes=quota,
        max_fetch_bytes=1024 * 1024,
        virustotal_api_key=None,
    )


@pytest.mark.asyncio
async def test_import_from_connector_respects_quota_and_deletes_fetch(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    content = b"PK\x03\x04quota-epub"
    fetched = tmp_path / "book.epub"
    fetched.write_bytes(content)
    storage_dir = tmp_path / "library"

    monkeypatch.setattr(
        library,
        "get_settings",
        lambda: _settings(storage_dir, quota=len(content)),
    )
    monkeypatch.setattr(
        "ferry_agent.services.library.get_connector",
        lambda name: _FakeConnector(str(fetched)),
    )

    # 1) pas d'item existant  2) SUM(size_bytes) = deja au plafond
    existing = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    used = MagicMock(scalar_one_or_none=MagicMock(return_value=len(content)))
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[existing, used])
    db.add = MagicMock()
    db.commit = AsyncMock()

    with pytest.raises(QuotaExceededError, match="espace est plein"):
        await library.import_from_connector(db, _USER_ID, "gutenberg", "99")

    assert not fetched.exists()
    assert list(storage_dir.rglob("*")) == [] if storage_dir.exists() else True
    db.add.assert_not_called()
    db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_import_from_gateway_respects_quota(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    content = b"%PDF-1.7 gateway"
    storage_dir = tmp_path / "library"
    monkeypatch.setattr(
        library,
        "get_settings",
        lambda: _settings(storage_dir, quota=len(content)),
    )

    used = MagicMock(scalar_one_or_none=MagicMock(return_value=len(content)))
    db = AsyncMock()
    db.execute = AsyncMock(return_value=used)
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()

    with pytest.raises(QuotaExceededError, match="espace est plein"):
        await library.import_from_gateway(
            db,
            _USER_ID,
            uuid.uuid4(),
            uuid.uuid4(),
            "book.pdf",
            content,
            "pdf",
            {"title": "Dune"},
        )

    assert list(storage_dir.rglob("*")) == [] if storage_dir.exists() else True
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_submit_fetch_result_returns_507_when_quota_exceeded(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from io import BytesIO

    from fastapi import UploadFile

    from ferry_agent.api.gateways import submit_fetch_result

    content = b"%PDF-1.7 gateway-fetch"
    gateway = make_gateway(pairing_status=PairingStatus.paired)
    job = GatewayJob(
        id=uuid.uuid4(),
        gateway_id=gateway.id,
        type=GatewayJobType.fetch,
        payload={"result": {"title": "Dune"}},
        status=GatewayJobStatus.running,
    )

    async def get_job(*_args, **_kwargs):
        return job

    monkeypatch.setattr("ferry_agent.api.gateways.gateway_service.get_gateway_job", get_job)
    monkeypatch.setattr(
        "ferry_agent.api.gateways.get_settings",
        lambda: SimpleNamespace(max_fetch_bytes=1024 * 1024, virustotal_api_key=None),
    )
    monkeypatch.setattr(
        library,
        "get_settings",
        lambda: _settings(tmp_path / "library", quota=len(content)),
    )

    db = FakeSession(execute_values=[len(content)])
    with pytest.raises(HTTPException) as exc:
        await submit_fetch_result(
            job.id,
            UploadFile(filename="book.pdf", file=BytesIO(content)),
            gateway,
            db,
        )
    assert exc.value.status_code == 507
    assert exc.value.detail == QUOTA_EXCEEDED_MESSAGE
    assert job.status == GatewayJobStatus.failed
    assert job.result_ref == QUOTA_EXCEEDED_MESSAGE


@pytest.mark.asyncio
async def test_post_books_connector_returns_507_when_quota_exceeded(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Contrat HTTP : POST /books (source legale) propage le 507 quota."""
    from fastapi.testclient import TestClient

    from ferry_agent.main import app
    from tests.fakes import clear_app_deps, override_app_deps

    content = b"PK\x03\x04quota"
    fetched = tmp_path / "x.epub"
    fetched.write_bytes(content)

    monkeypatch.setattr(
        library,
        "get_settings",
        lambda: _settings(tmp_path / "lib", quota=len(content)),
    )
    monkeypatch.setattr(
        "ferry_agent.services.library.get_connector",
        lambda name: _FakeConnector(str(fetched)),
    )

    existing = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    used = MagicMock(scalar_one_or_none=MagicMock(return_value=len(content)))

    async def fake_db():
        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[existing, used])
        db.add = MagicMock()
        db.commit = AsyncMock()
        yield db

    override_app_deps(fake_db, user_id=_USER_ID)
    try:
        with TestClient(app) as client:
            resp = client.post(
                "/api/v1/books",
                json={"source": "gutenberg", "result_id": "1", "result": {"title": "T"}},
            )
        assert resp.status_code == 507
        assert resp.json()["detail"] == QUOTA_EXCEEDED_MESSAGE
        assert not fetched.exists()
    finally:
        clear_app_deps()
