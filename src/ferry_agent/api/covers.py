"""Proxy authentifie des couvertures de LibraryItem."""

import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.db import get_db
from ferry_agent.models import LibraryItem
from ferry_agent.services.covers import fetch_cover_to_cache, validate_cover_url

router = APIRouter(prefix="/api/v1/covers", tags=["covers"])


@router.get("/{item_id}")
async def get_cover(
    item_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """Sert la couverture d'un item possede, telechargee et mise en cache cote serveur."""
    result = await db.execute(
        select(LibraryItem).where(LibraryItem.id == item_id, LibraryItem.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="introuvable")

    cover_url = validate_cover_url(item.cover_url)
    if cover_url is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="couverture indisponible")

    try:
        path, media_type = await fetch_cover_to_cache(str(item.id), cover_url)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="echec du telechargement de la couverture",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return FileResponse(path, media_type=media_type)
