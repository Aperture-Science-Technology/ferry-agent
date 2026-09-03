"""Liste des Sources de l'utilisateur courant."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.db import get_db
from ferry_agent.models import Source
from ferry_agent.schemas import SourceOut

router = APIRouter(prefix="/api/v1/sources", tags=["sources"])


@router.get("", response_model=list[SourceOut])
async def list_sources(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SourceOut]:
    result = await db.execute(select(Source).where(Source.user_id == user.id))
    sources = result.scalars().all()
    return [SourceOut.model_validate(s) for s in sources]
