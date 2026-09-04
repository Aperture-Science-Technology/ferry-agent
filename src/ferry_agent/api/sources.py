"""Liste et activation/desactivation des Sources de l'utilisateur courant."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.db import get_db
from ferry_agent.models import Source
from ferry_agent.schemas import SourceOut, SourceUpdate

router = APIRouter(prefix="/api/v1/sources", tags=["sources"])


@router.get("", response_model=list[SourceOut])
async def list_sources(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SourceOut]:
    result = await db.execute(select(Source).where(Source.user_id == user.id))
    sources = result.scalars().all()
    return [SourceOut.model_validate(s) for s in sources]


@router.patch("/{source_id}", response_model=SourceOut)
async def update_source(
    source_id: uuid.UUID,
    payload: SourceUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SourceOut:
    result = await db.execute(
        select(Source).where(Source.id == source_id, Source.user_id == user.id)
    )
    source = result.scalar_one_or_none()
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="introuvable")
    source.enabled = payload.enabled
    await db.commit()
    await db.refresh(source)
    return SourceOut.model_validate(source)
