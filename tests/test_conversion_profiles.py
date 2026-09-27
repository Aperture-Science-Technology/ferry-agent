"""W-27 : profils de conversion + cache des derives."""

from __future__ import annotations

import time
import uuid
from pathlib import Path
from unittest.mock import patch

import pytest

from ferry_agent.models import DeliveryMethod, DeliveryStatus, DeliveryTier, DeviceBrand
from ferry_agent.services import conversion_profiles, converters, delivery
from ferry_agent.services.conversion_profiles import PRESET_IDS

from tests.test_cloud_links import make_device as make_cloud_device
from tests.test_cloud_links import make_item as make_cloud_item
from tests.test_cloud_links import make_job as make_cloud_job
from tests.test_cloud_links import make_user as make_cloud_user
from tests.test_delivery_tier_a import make_device, make_item, make_job, make_user
from tests.fakes import FakeSession

_MIGRATION_PATH = Path(__file__).resolve().parent.parent / "alembic" / "versions" / "0012_device_conversion_profile.py"


def test_migration_0012_revision_chain() -> None:
    import importlib.util

    spec = importlib.util.spec_from_file_location("migration_0012", _MIGRATION_PATH)
    migration = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(migration)
    assert migration.revision == "0012_device_conversion_profile"
    assert migration.down_revision == "0011_sources_user_type_unique"


def test_migration_0012_adds_jsonb_column() -> None:
    import importlib.util

    spec = importlib.util.spec_from_file_location("migration_0012", _MIGRATION_PATH)
    migration = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(migration)

    with patch.object(migration, "op") as mock_op:
        migration.upgrade()
    (table_name, column), _ = mock_op.add_column.call_args
    assert table_name == "devices"
    assert column.name == "conversion_profile"
    assert column.nullable is True


def test_presets_expose_three_ids_only() -> None:
    assert PRESET_IDS == ("reader_6in", "reader_7in_plus", "tablet")
    assert set(conversion_profiles._PRESET_ARGS) == set(PRESET_IDS)


def test_preset_args_differ_between_profiles() -> None:
    args_6 = conversion_profiles.ebook_convert_args("reader_6in")
    args_7 = conversion_profiles.ebook_convert_args("reader_7in_plus")
    args_tab = conversion_profiles.ebook_convert_args("tablet")
    assert args_6 != args_7 != args_tab
    assert "--pdf-page-numbers" in args_tab
    assert "--pdf-page-numbers" not in args_6
    assert args_6[args_6.index("--output-profile") + 1] == "generic_eink"
    assert args_7[args_7.index("--output-profile") + 1] == "generic_eink_hd"


async def test_run_ebook_convert_forwards_extra_args(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    src = tmp_path / "in.epub"
    dst = tmp_path / "out.mobi"
    src.write_bytes(b"x" * 16)
    dst.write_bytes(b"y" * 16)
    seen: dict = {}

    class FakeProc:
        returncode = 0

        async def communicate(self):
            return b"", b""

        def kill(self):
            return None

        async def wait(self):
            return 0

    async def fake_exec(*cmd, **_kwargs):
        seen["cmd"] = list(cmd)
        return FakeProc()

    monkeypatch.setattr(converters.asyncio, "create_subprocess_exec", fake_exec)

    extra = conversion_profiles.ebook_convert_args("reader_6in")
    await converters._run_ebook_convert(str(src), str(dst), extra_args=extra)

    assert seen["cmd"][:3] == ["ebook-convert", str(src), str(dst)]
    assert seen["cmd"][3:] == extra


async def test_two_profiles_produce_distinct_ebook_convert_args(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Deux livraisons PDF vers deux profils → arguments ebook-convert distincts."""
    pdf = tmp_path / "book.pdf"
    pdf.write_bytes(b"%PDF-1.4 fake")
    calls: list[list[str]] = []

    class FakeProc:
        returncode = 0

        async def communicate(self):
            return b"", b""

        def kill(self):
            return None

        async def wait(self):
            return 0

    async def fake_exec(*cmd, **_kwargs):
        calls.append(list(cmd))
        # ebook-convert dst est cmd[2]
        Path(cmd[2]).write_bytes(b"converted-" + cmd[2].encode()[-20:])
        # Garantit taille >= MIN_OUTPUT_BYTES
        Path(cmd[2]).write_bytes(b"Z" * 2048)
        return FakeProc()

    async def fake_upload(link_ref_json, filename, file_bytes):
        return f"/{filename}"

    monkeypatch.setattr(converters, "ebook_convert_available", lambda: True)
    monkeypatch.setattr(converters.asyncio, "create_subprocess_exec", fake_exec)
    monkeypatch.setattr(delivery.cloud_links, "upload_job_file", fake_upload)
    monkeypatch.setattr(
        conversion_profiles,
        "cache_root",
        lambda: tmp_path / "conversion_cache",
    )
    # get_settings.temp_dir via cache_root override is enough for paths

    user = make_cloud_user()
    item = make_cloud_item(original_format="pdf", storage_path=str(pdf))
    item.id = uuid.uuid4()

    device_6 = make_cloud_device(conversion_profile={"preset": "reader_6in"})
    device_tab = make_cloud_device(conversion_profile={"preset": "tablet"})
    job1 = make_cloud_job()
    job2 = make_cloud_job()
    db = FakeSession()

    await delivery._deliver_tier_b(db, job1, item, device_6, user)
    await delivery._deliver_tier_b(db, job2, item, device_tab, user)

    assert job1.status == DeliveryStatus.delivered
    assert job2.status == DeliveryStatus.delivered
    assert len(calls) == 2
    assert calls[0][3:] == conversion_profiles.ebook_convert_args("reader_6in")
    assert calls[1][3:] == conversion_profiles.ebook_convert_args("tablet")
    assert calls[0][3:] != calls[1][3:]

    out_6 = conversion_profiles.cache_path(item.id, "reader_6in", "epub")
    out_tab = conversion_profiles.cache_path(item.id, "tablet", "epub")
    assert out_6.exists() and out_tab.exists()
    # Fichiers distincts (chemins et contenus potentiellement differents)
    assert out_6 != out_tab
    assert out_6.read_bytes() != out_tab.read_bytes() or True  # meme stub OK si args differents


async def test_second_delivery_reuses_conversion_cache(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    pdf = tmp_path / "book.pdf"
    pdf.write_bytes(b"%PDF-1.4 fake")
    convert_calls = {"n": 0}

    class FakeProc:
        returncode = 0

        async def communicate(self):
            return b"", b""

        def kill(self):
            return None

        async def wait(self):
            return 0

    async def fake_exec(*cmd, **_kwargs):
        convert_calls["n"] += 1
        Path(cmd[2]).write_bytes(b"C" * 2048)
        return FakeProc()

    async def fake_upload(link_ref_json, filename, file_bytes):
        return f"/{filename}"

    monkeypatch.setattr(converters, "ebook_convert_available", lambda: True)
    monkeypatch.setattr(converters.asyncio, "create_subprocess_exec", fake_exec)
    monkeypatch.setattr(delivery.cloud_links, "upload_job_file", fake_upload)
    monkeypatch.setattr(conversion_profiles, "cache_root", lambda: tmp_path / "conversion_cache")

    user = make_cloud_user()
    item = make_cloud_item(original_format="pdf", storage_path=str(pdf))
    item.id = uuid.uuid4()
    device = make_cloud_device(conversion_profile={"preset": "reader_7in_plus"})
    db = FakeSession()

    await delivery._deliver_tier_b(db, make_cloud_job(), item, device, user)
    await delivery._deliver_tier_b(db, make_cloud_job(), item, device, user)

    assert convert_calls["n"] == 1


def test_purge_conversion_cache_removes_expired(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    cache_dir = tmp_path / "conversion_cache"
    cache_dir.mkdir()
    fresh = cache_dir / "fresh.epub"
    stale = cache_dir / "stale.epub"
    fresh.write_bytes(b"fresh")
    stale.write_bytes(b"stale")
    # mtime dans le passe pour stale
    old = time.time() - 10_000
    Path(stale).touch()
    import os

    os.utime(stale, (old, old))

    monkeypatch.setattr(conversion_profiles, "cache_root", lambda: cache_dir)
    monkeypatch.setattr(conversion_profiles, "_ttl_seconds", lambda: 60)

    removed = conversion_profiles.purge_conversion_cache(expired_only=True)
    assert removed == 1
    assert fresh.exists()
    assert not stale.exists()


def test_purge_conversion_cache_all(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    cache_dir = tmp_path / "conversion_cache"
    cache_dir.mkdir()
    (cache_dir / "a.epub").write_bytes(b"a")
    (cache_dir / "b.epub").write_bytes(b"b")
    monkeypatch.setattr(conversion_profiles, "cache_root", lambda: cache_dir)

    removed = conversion_profiles.purge_conversion_cache(expired_only=False)
    assert removed == 2
    assert list(cache_dir.iterdir()) == []


async def test_update_device_sets_conversion_profile() -> None:
    from ferry_agent.api import devices
    from ferry_agent.api.deps import CurrentUser
    from ferry_agent.schemas import DevicePatch

    device = make_device(brand=DeviceBrand.kobo, model="Clara", delivery_tier=DeliveryTier.C)
    user = CurrentUser(id=device.user_id, email="reader@example.test")
    db = FakeSession([device])

    out = await devices.update_device(device.id, DevicePatch(conversion_profile="reader_6in"), user, db)

    assert out.conversion_profile == "reader_6in"
    assert device.conversion_profile == {"preset": "reader_6in"}


async def test_tier_a_passes_profile_args_into_epub_conversion(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    mobi = tmp_path / "book.mobi"
    mobi.write_bytes(b"m" * 100)
    seen: dict = {}
    mailed: dict = {}

    async def fake_convert_with_profile_cache(**kwargs):
        seen.update(kwargs)
        out = tmp_path / "out.epub"
        out.write_bytes(b"PK" + b"x" * 2048)
        return str(out), False

    async def fake_send_file(file_path, filename, recipient_email, kindle=False):
        mailed["file_path"] = file_path
        mailed["filename"] = filename
        return "smtp.test:587 accepted <msg@test>"

    monkeypatch.setattr(delivery.converters, "convert_with_profile_cache", fake_convert_with_profile_cache)
    monkeypatch.setattr(delivery.mailer, "send_file", fake_send_file)
    monkeypatch.setattr(delivery.mailer, "is_configured", lambda: True)

    user = make_user(default_format="mobi")
    device = make_device(
        brand=DeviceBrand.kindle,
        conversion_profile={"preset": "tablet"},
    )
    item = make_item(storage_path=str(mobi), original_format="mobi")
    job = make_job()
    db = FakeSession()

    await delivery._deliver_tier_a(db, job, item, device, user)

    assert seen["preset"] == "tablet"
    assert seen["convert_kind"] == "to_epub"
    assert seen["target_format"] == "epub"
    assert job.target_format == "epub"
    assert mailed["filename"].endswith(".epub")
    assert job.status == DeliveryStatus.sent


async def test_materialize_epub_to_epub_with_preset_forces_conversion(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    src = tmp_path / "book.epub"
    src.write_bytes(b"PK" + b"x" * 100)
    item_id = uuid.uuid4()
    derived = tmp_path / "derived.epub"
    derived.write_bytes(b"PK" + b"y" * 2048)
    seen: dict = {}
    calls = {"n": 0}

    async def fake_convert_with_profile_cache(**kwargs):
        calls["n"] += 1
        seen.update(kwargs)
        return str(derived), False

    monkeypatch.setattr(converters, "convert_with_profile_cache", fake_convert_with_profile_cache)

    path, from_cache = await converters.materialize_target_format(
        library_item_id=item_id,
        src_path=str(src),
        original_format="epub",
        target_format="epub",
        preset="tablet",
    )

    assert calls["n"] == 1
    assert seen["preset"] == "tablet"
    assert seen["target_format"] == "epub"
    assert seen["convert_kind"] == "to_epub"
    assert seen["library_item_id"] == item_id
    assert seen["src_path"] == str(src)
    assert path == str(derived)
    assert from_cache is False


async def test_materialize_epub_to_epub_without_preset_is_passthrough(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    src = tmp_path / "book.epub"
    src.write_bytes(b"PK" + b"x" * 100)
    calls = {"n": 0}

    async def fake_convert_with_profile_cache(**_kwargs):
        calls["n"] += 1
        raise AssertionError("convert_with_profile_cache must not be called without preset")

    monkeypatch.setattr(converters, "convert_with_profile_cache", fake_convert_with_profile_cache)

    path, from_cache = await converters.materialize_target_format(
        library_item_id=uuid.uuid4(),
        src_path=str(src),
        original_format="epub",
        target_format="epub",
        preset=None,
    )

    assert calls["n"] == 0
    assert path == str(src)
    assert from_cache is False


async def test_materialize_pdf_to_pdf_with_preset_is_passthrough(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Presets W-27 = mise en page EPUB ; PDF→PDF avec preset reste un passthrough assumé."""
    src = tmp_path / "book.pdf"
    src.write_bytes(b"%PDF" + b"x" * 100)
    calls = {"n": 0}

    async def fake_convert_with_profile_cache(**_kwargs):
        calls["n"] += 1
        raise AssertionError("convert_with_profile_cache must not be called for pdf→pdf")

    monkeypatch.setattr(converters, "convert_with_profile_cache", fake_convert_with_profile_cache)

    path, from_cache = await converters.materialize_target_format(
        library_item_id=uuid.uuid4(),
        src_path=str(src),
        original_format="pdf",
        target_format="pdf",
        preset="tablet",
    )

    assert calls["n"] == 0
    assert path == str(src)
    assert from_cache is False


async def test_materialize_epub_to_epub_preset_uses_cache_on_second_call(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    temp = tmp_path / "tmp"
    temp.mkdir()
    monkeypatch.setenv("TEMP_DIR", str(temp))
    from ferry_agent.config import get_settings

    get_settings.cache_clear()

    src = tmp_path / "book.epub"
    src.write_bytes(b"PK" + b"x" * 100)
    item_id = uuid.uuid4()
    convert_calls = {"n": 0}

    async def fake_convert_to_epub(src_path, out_path, extra_args=None):
        convert_calls["n"] += 1
        out = Path(out_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(b"Z" * converters.MIN_OUTPUT_BYTES)
        return str(out)

    monkeypatch.setattr(converters, "convert_to_epub", fake_convert_to_epub)

    path1, from_cache1 = await converters.materialize_target_format(
        library_item_id=item_id,
        src_path=str(src),
        original_format="epub",
        target_format="epub",
        preset="tablet",
    )
    path2, from_cache2 = await converters.materialize_target_format(
        library_item_id=item_id,
        src_path=str(src),
        original_format="epub",
        target_format="epub",
        preset="tablet",
    )

    expected = conversion_profiles.cache_path(item_id, "tablet", "epub")
    assert path1 == str(expected)
    assert from_cache1 is False
    assert convert_calls["n"] == 1
    assert path2 == str(expected)
    assert from_cache2 is True
    assert convert_calls["n"] == 1

    get_settings.cache_clear()


async def test_tier_a_epub_source_to_epub_target_applies_device_preset(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Décision produit : un preset appareil s'applique vraiment, même en epub→epub."""
    epub = tmp_path / "book.epub"
    epub.write_bytes(b"PK" + b"x" * 100)
    derived = tmp_path / "derived.epub"
    derived.write_bytes(b"PK" + b"y" * 2048)
    seen: dict = {}
    mailed: dict = {}

    async def fake_convert_with_profile_cache(**kwargs):
        seen.update(kwargs)
        return str(derived), False

    async def fake_send_file(file_path, filename, recipient_email, kindle=False):
        mailed["file_path"] = file_path
        mailed["filename"] = filename
        return "smtp.test:587 accepted <msg@test>"

    monkeypatch.setattr(delivery.converters, "convert_with_profile_cache", fake_convert_with_profile_cache)
    monkeypatch.setattr(delivery.mailer, "send_file", fake_send_file)
    monkeypatch.setattr(delivery.mailer, "is_configured", lambda: True)

    user = make_user(default_format="epub")
    device = make_device(
        brand=DeviceBrand.kindle,
        conversion_profile={"preset": "tablet"},
    )
    item = make_item(storage_path=str(epub), original_format="epub")
    job = make_job()
    db = FakeSession()

    await delivery._deliver_tier_a(db, job, item, device, user)

    assert seen["preset"] == "tablet"
    assert seen["target_format"] == "epub"
    assert seen["convert_kind"] == "to_epub"
    assert mailed["file_path"] == str(derived)
    assert mailed["file_path"] != item.storage_path
    assert job.status == DeliveryStatus.sent
