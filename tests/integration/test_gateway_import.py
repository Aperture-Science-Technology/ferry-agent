"""Régressions des imports gateway avec les contraintes Postgres réelles."""

import uuid
from pathlib import Path

import pytest
from sqlalchemy import select

from ferry_agent.config import Settings
from ferry_agent.models import LibraryItem, Source, SourceType, User
from ferry_agent.services import library


@pytest.fixture
async def gateway_import(db_session, tmp_path, monkeypatch):
    """Prépare un utilisateur isolé et un stockage local pour ses imports."""
    user = User(email=f"gateway-import-{uuid.uuid4().hex}@example.test")
    db_session.add(user)
    await db_session.commit()
    settings = Settings(library_storage_dir=str(tmp_path / "library"))
    monkeypatch.setattr(library, "get_settings", lambda: settings)
    gateway_id = uuid.uuid4()

    async def import_book(job_id, content=b"premier livre"):
        return await library.import_from_gateway(
            db_session, user.id, gateway_id, job_id,
            "livre.epub", content, "epub", {"title": "Un livre"},
        )

    return user.id, gateway_id, import_book, settings


async def test_successive_gateway_imports_share_source(db_session, gateway_import):
    """Le deuxième livre réussit et partage la source du premier."""
    user_id, gateway_id, import_book, _ = gateway_import
    first_job, second_job = uuid.uuid4(), uuid.uuid4()
    first = await import_book(first_job)
    second = await import_book(second_job, b"deuxieme livre")

    assert first.id != second.id
    assert first.source_id == second.source_id
    assert first.source_ref == f"gateway:{gateway_id}:{first_job}"
    assert second.source_ref == f"gateway:{gateway_id}:{second_job}"
    assert first.storage_path != second.storage_path
    assert Path(first.storage_path).read_bytes() == b"premier livre"
    assert Path(second.storage_path).read_bytes() == b"deuxieme livre"
    sources = (await db_session.scalars(select(Source).where(Source.user_id == user_id))).all()
    assert len(sources) == 1
    assert sources[0].type == SourceType.torrent_gateway
    assert sources[0].config == {}
    items = (await db_session.scalars(select(LibraryItem).where(LibraryItem.user_id == user_id))).all()
    assert len(items) == 2


async def test_gateway_import_is_idempotent(db_session, gateway_import):
    """Un renvoi du même travail conserve un seul livre et un seul fichier."""
    user_id, _, import_book, settings = gateway_import
    job_id = uuid.uuid4()
    first = await import_book(job_id)
    second = await import_book(job_id, b"contenu renvoye")

    assert second.id == first.id
    assert second.storage_path == first.storage_path
    assert Path(second.storage_path).read_bytes() == b"premier livre"
    items = (await db_session.scalars(select(LibraryItem).where(LibraryItem.user_id == user_id))).all()
    assert len(items) == 1
    assert list(Path(settings.library_storage_dir).iterdir()) == [Path(first.storage_path)]

    # Même un quota désormais atteint ne doit pas bloquer le renvoi du résultat.
    settings.user_storage_quota_bytes = first.size_bytes
    assert (await import_book(job_id)).id == first.id


async def test_gateway_import_preserves_existing_source_config(db_session, gateway_import):
    """La configuration partagée préexistante reste intacte après l'import."""
    user_id, _, import_book, _ = gateway_import
    config = {"gateway_id": "ancienne-gateway", "options": {"conserver": True}}
    source = Source(user_id=user_id, type=SourceType.torrent_gateway, config=config)
    db_session.add(source)
    await db_session.commit()

    item = await import_book(uuid.uuid4())

    await db_session.refresh(source)
    assert item.source_id == source.id
    assert source.config == config


async def test_gateway_epub_metadata_survives_reload(db_session, gateway_import):
    from ferry_agent.services.covers import embedded_cover
    from tests.test_delivery_truth import epub_bytes

    user_id, gateway_id, _, _ = gateway_import
    item = await library.import_from_gateway(
        db_session, user_id, gateway_id, uuid.uuid4(),
        'Release.FRENCH.[EPUB]-NOTAG.epub', epub_bytes(), 'epub', {},
    )
    item_id = item.id
    db_session.expire_all()
    saved = await db_session.get(LibraryItem, item_id)
    assert saved.title == 'Les Deux Tours'
    assert saved.author == 'J. R. R. Tolkien'
    assert saved.language == 'fr'
    assert saved.publisher == 'Bourgois'
    assert saved.published_year == 1972
    assert saved.isbn == '9782266282362'
    assert saved.page_count is None
    assert saved.cover_url == f'/api/v1/covers/{item_id}'
    assert embedded_cover(saved)[0].read_bytes().startswith(b'\x89PNG')
