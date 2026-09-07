"""W-05 / W-29 : bornage + sniff + quota sur upload books.

Couvre les criteres d'acceptation HTTP (413 / 422 / 507 / contenu > extension /
neutralisation traversal) sans Postgres, via TestClient + overrides
`get_db` / `get_current_user` (cf. `tests/test_books_crud.py`).

Choix 413 : `max_fetch_bytes` est reduit via monkeypatch de `get_settings`
(sur `api.books` et `services.library`) pour exercer vraiment `read_limited`
avec un payload de `max + 1` octets, sans mocker l'erreur.

W-29 : la route canonique est `POST /api/v1/books/upload` ; le multipart sur
`POST /api/v1/books` reste teste (deprecated, Deprecation header).
"""

from __future__ import annotations

import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from ferry_agent.main import app
from ferry_agent.models import LibraryItem, Source, SourceType
from ferry_agent.services.errors import QUOTA_EXCEEDED_MESSAGE
from tests.fakes import FakeSession, clear_app_deps, override_app_deps

_USER_ID = uuid.uuid4()
_USER_EMAIL = "test@example.com"

_PDF_BYTES = b"%PDF-1.7 minimal-content"
_EPUB_BYTES = b"PK\x03\x04epub-minimal-content"
_PLAIN_TEXT = b"this is plain text, not an ebook"


def _settings(
    storage_dir: Path,
    *,
    max_fetch_bytes: int = 1024,
    user_storage_quota_bytes: int = 1024 * 1024,
) -> SimpleNamespace:
    return SimpleNamespace(
        max_fetch_bytes=max_fetch_bytes,
        user_storage_quota_bytes=user_storage_quota_bytes,
        library_storage_dir=str(storage_dir),
        virustotal_api_key=None,
    )


def _patch_settings(monkeypatch: pytest.MonkeyPatch, settings: SimpleNamespace) -> None:
    monkeypatch.setattr("ferry_agent.api.books.get_settings", lambda: settings)
    monkeypatch.setattr("ferry_agent.services.library.get_settings", lambda: settings)


def _upload_db(*, used_bytes: int = 0):
    source = Source(
        id=uuid.uuid4(),
        user_id=_USER_ID,
        type=SourceType.upload,
        config={},
    )

    async def fake_db():
        # Premier execute = SUM(size_bytes) quota ; ensuite Source via always.
        yield FakeSession(execute_values=[used_bytes], always=source)

    return fake_db


def _storage_files(storage_dir: Path) -> list[Path]:
    if not storage_dir.exists():
        return []
    return [p for p in storage_dir.rglob("*") if p.is_file()]


def _post_upload(
    client: TestClient,
    filename: str,
    content: bytes,
    content_type: str = "application/octet-stream",
    *,
    path: str = "/api/v1/books/upload",
):
    return client.post(
        path,
        files={"file": (filename, content, content_type)},
    )


class TestUploadTooLarge:
    def test_returns_413_and_writes_nothing(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        storage_dir = tmp_path / "library"
        max_bytes = 64
        settings = _settings(storage_dir, max_fetch_bytes=max_bytes)
        _patch_settings(monkeypatch, settings)

        override_app_deps(_upload_db(), user_id=_USER_ID, email=_USER_EMAIL)
        try:
            with TestClient(app) as client:
                resp = _post_upload(client, "huge.pdf", b"x" * (max_bytes + 1), "application/pdf")
            assert resp.status_code == 413
            assert "trop volumineux" in resp.json()["detail"]
            assert _storage_files(storage_dir) == []
        finally:
            clear_app_deps()


class TestUploadUnknownFormat:
    def test_plain_text_epub_returns_422_and_writes_nothing(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ):
        storage_dir = tmp_path / "library"
        _patch_settings(monkeypatch, _settings(storage_dir))

        override_app_deps(_upload_db(), user_id=_USER_ID, email=_USER_EMAIL)
        try:
            with TestClient(app) as client:
                resp = _post_upload(
                    client,
                    "fake.epub",
                    _PLAIN_TEXT,
                    "application/epub+zip",
                )
            assert resp.status_code == 422
            assert "livre reconnu" in resp.json()["detail"]
            assert _storage_files(storage_dir) == []
        finally:
            clear_app_deps()


class TestUploadQuotaExceeded:
    def test_returns_507_translated_and_writes_nothing(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ):
        storage_dir = tmp_path / "library"
        _patch_settings(
            monkeypatch,
            _settings(storage_dir, user_storage_quota_bytes=len(_PDF_BYTES)),
        )

        # Deja plein : used == quota, tout ajout depasse.
        override_app_deps(
            _upload_db(used_bytes=len(_PDF_BYTES)),
            user_id=_USER_ID,
            email=_USER_EMAIL,
        )
        try:
            with TestClient(app) as client:
                resp = _post_upload(client, "book.pdf", _PDF_BYTES, "application/pdf")
            assert resp.status_code == 507
            assert resp.json()["detail"] == QUOTA_EXCEEDED_MESSAGE
            assert _storage_files(storage_dir) == []
        finally:
            clear_app_deps()


class TestUploadContentOverExtension:
    def test_pdf_bytes_named_epub_yields_original_format_pdf(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ):
        storage_dir = tmp_path / "library"
        _patch_settings(monkeypatch, _settings(storage_dir))

        override_app_deps(_upload_db(), user_id=_USER_ID, email=_USER_EMAIL)
        try:
            with TestClient(app) as client:
                resp = _post_upload(
                    client,
                    "book.epub",
                    _PDF_BYTES,
                    "application/epub+zip",
                )
            assert resp.status_code == 201
            assert resp.json()["original_format"] == "pdf"
            assert len(_storage_files(storage_dir)) == 1
        finally:
            clear_app_deps()


class TestUploadTraversalNeutralized:
    def test_dotdot_filename_stays_under_library_storage(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ):
        storage_dir = tmp_path / "library"
        _patch_settings(monkeypatch, _settings(storage_dir))

        source = Source(
            id=uuid.uuid4(),
            user_id=_USER_ID,
            type=SourceType.upload,
            config={},
        )
        db = FakeSession(execute_values=[0], always=source)

        async def fake_db():
            yield db

        override_app_deps(fake_db, user_id=_USER_ID, email=_USER_EMAIL)
        try:
            with TestClient(app) as client:
                resp = _post_upload(
                    client,
                    "../../etc/passwd",
                    _PDF_BYTES,
                    "application/pdf",
                )
            assert resp.status_code == 201

            items = [obj for obj in db.added if isinstance(obj, LibraryItem)]
            assert len(items) == 1
            storage_path = Path(items[0].storage_path)
            assert ".." not in storage_path.parts
            assert ".." not in storage_path.name
            assert storage_path.resolve().is_relative_to(storage_dir.resolve())
            assert storage_path.is_file()
            # Basename neutralise : Path("../../etc/passwd").name == "passwd"
            assert storage_path.name.endswith("_passwd")
        finally:
            clear_app_deps()


class TestDeprecatedMultipartBooks:
    def test_legacy_multipart_still_works_with_deprecation_header(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ):
        storage_dir = tmp_path / "library"
        _patch_settings(monkeypatch, _settings(storage_dir))

        override_app_deps(_upload_db(), user_id=_USER_ID, email=_USER_EMAIL)
        try:
            with TestClient(app) as client:
                resp = _post_upload(
                    client,
                    "book.pdf",
                    _PDF_BYTES,
                    "application/pdf",
                    path="/api/v1/books",
                )
            assert resp.status_code == 201
            assert resp.headers.get("deprecation") == "true"
            assert "/api/v1/books/upload" in resp.headers.get("link", "")
        finally:
            clear_app_deps()
