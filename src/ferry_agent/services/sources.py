"""Sources par defaut d'un utilisateur (creation compte + idempotence liste)."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.models import Source, SourceType

DEFAULT_SOURCE_TYPES: tuple[SourceType, ...] = (
    SourceType.gutenberg,
    SourceType.standard_ebooks,
    SourceType.upload,
)


async def ensure_default_sources(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Insere les Source par defaut manquantes pour ``user_id`` (idempotent).

    Les appels concurrents s'appuient sur ``UNIQUE(user_id, type)`` : un
    ``IntegrityError`` signifie qu'un autre requete a gagne la course — on
    rollback et on laisse l'appelant relire l'etat coherent.
    """
    result = await db.execute(
        select(Source.type).where(
            Source.user_id == user_id,
            Source.type.in_(DEFAULT_SOURCE_TYPES),
        )
    )
    existing = set(result.scalars().all())
    missing = [t for t in DEFAULT_SOURCE_TYPES if t not in existing]
    if not missing:
        return

    for source_type in missing:
        db.add(
            Source(
                user_id=user_id,
                type=source_type,
                config={},
                enabled=True,
            )
        )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
