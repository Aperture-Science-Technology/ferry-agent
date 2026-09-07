"""W-12 : sources par defaut a la creation utilisateur + idempotence liste."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select

from ferry_agent.api.deps import _get_or_create_user
from ferry_agent.main import app
from ferry_agent.models import Source, SourceType, User
from ferry_agent.services.sources import DEFAULT_SOURCE_TYPES


async def test_new_user_gets_exactly_three_default_sources(db_session) -> None:
    """Premier appel authentifie (creation User) materielise 3 Source."""
    email = f"w12-new-{uuid.uuid4().hex}@example.test"
    user = await _get_or_create_user(db_session, email)

    result = await db_session.execute(
        select(Source.type).where(Source.user_id == user.id)
    )
    types = set(result.scalars().all())
    assert types == set(DEFAULT_SOURCE_TYPES)
    assert SourceType.torrent_gateway not in types
    assert SourceType.opds not in types

    count = await db_session.scalar(
        select(func.count()).select_from(Source).where(Source.user_id == user.id)
    )
    assert count == 3


async def test_list_sources_backfills_and_is_idempotent(client, db_session) -> None:
    """Compte pre-existant sans Source : GET cree 3, second GET reste a 3."""
    # Le fixture `client` cree un User sans passer par _get_or_create_user.
    from ferry_agent.api.deps import get_current_user

    user_id = app.dependency_overrides[get_current_user]().id
    existing = await db_session.scalar(
        select(func.count()).select_from(Source).where(Source.user_id == user_id)
    )
    assert existing == 0

    first = await client.get("/api/v1/sources")
    assert first.status_code == 200
    assert len(first.json()) == 3
    types_first = {s["type"] for s in first.json()}
    assert types_first == {t.value for t in DEFAULT_SOURCE_TYPES}

    second = await client.get("/api/v1/sources")
    assert second.status_code == 200
    assert len(second.json()) == 3

    count = await db_session.scalar(
        select(func.count()).select_from(Source).where(Source.user_id == user_id)
    )
    assert count == 3


async def test_unique_user_id_type_rejects_duplicate(db_session) -> None:
    """La contrainte UNIQUE(user_id, type) bloque un doublon explicite."""
    from sqlalchemy.exc import IntegrityError

    user = User(email=f"w12-uniq-{uuid.uuid4().hex}@example.test")
    db_session.add(user)
    await db_session.flush()
    db_session.add(
        Source(user_id=user.id, type=SourceType.gutenberg, config={}, enabled=True)
    )
    await db_session.commit()

    db_session.add(
        Source(user_id=user.id, type=SourceType.gutenberg, config={}, enabled=True)
    )
    try:
        await db_session.commit()
        raise AssertionError("IntegrityError attendue pour doublon (user_id, type)")
    except IntegrityError:
        await db_session.rollback()
