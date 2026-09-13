"""FA-FUNC-SETTINGS-01 : concurrence d'initialisation des sources par defaut."""

from __future__ import annotations

import asyncio
import uuid

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from ferry_agent.models import Source, User
from ferry_agent.services.sources import DEFAULT_SOURCE_TYPES, ensure_default_sources


@pytest.mark.asyncio
async def test_concurrent_ensure_default_sources_yields_exactly_three(
    migrated_db: str,
) -> None:
    """Deux ensure_default_sources paralleles : UNIQUE empeche les doublons."""
    engine = create_async_engine(migrated_db, pool_pre_ping=True, poolclass=NullPool)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory() as setup:
            user = User(email=f"settings-race-{uuid.uuid4().hex}@example.test")
            setup.add(user)
            await setup.commit()
            await setup.refresh(user)
            user_id = user.id

        async def _run() -> None:
            async with factory() as session:
                await ensure_default_sources(session, user_id)

        await asyncio.gather(_run(), _run())

        async with factory() as check:
            count = await check.scalar(
                select(func.count())
                .select_from(Source)
                .where(Source.user_id == user_id)
            )
            assert count == 3
            types = set(
                (
                    await check.execute(
                        select(Source.type).where(Source.user_id == user_id)
                    )
                )
                .scalars()
                .all()
            )
            assert types == set(DEFAULT_SOURCE_TYPES)
    finally:
        await engine.dispose()
