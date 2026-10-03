"""Telechargement public via jeton signe (TTL court).

Pas d'auth utilisateur : le jeton Fernet est la preuve. Toute erreur
(jeton invalide/expire, livre absent, conversion) → 404 sobre.
"""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.response_contracts import FILE_RESPONSES
from ferry_agent.db import get_db
from ferry_agent.models import LibraryItem
from ferry_agent.services import converters, download_links
from ferry_agent.services.file_validation import content_type_for_filename

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/downloads", tags=["downloads"])


def _download_filename(item: LibraryItem, fmt: str) -> str:
    base = (item.title or "book").strip() or "book"
    safe = "".join(c if (c.isalnum() or c in " -_.") else "_" for c in base)
    safe = " ".join(safe.split()).strip(" ._") or "book"
    return f"{safe[:120]}.{fmt}"


@router.get("/{token}", response_class=FileResponse, responses=FILE_RESPONSES)
async def download_by_token(token: str, db: AsyncSession = Depends(get_db)) -> FileResponse:
    """Sert le fichier ebook correspondant au jeton signe (sans auth)."""
    try:
        info = download_links.consume_download_token(token)
    except download_links.DownloadLinkError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="introuvable") from None

    result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.id == info.item_id,
            LibraryItem.user_id == info.user_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None or not item.storage_path or not Path(item.storage_path).is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="introuvable")

    try:
        file_path, _cached = await converters.materialize_target_format(
            library_item_id=item.id,
            src_path=item.storage_path,
            original_format=item.original_format,
            target_format=info.format,
            preset=None,
        )
    except Exception:
        logger.exception("materialize_target_format echoue pour download token")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="introuvable") from None

    if Path(file_path).suffix.lstrip(".").lower() != info.format:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="introuvable")

    filename = _download_filename(item, info.format)
    return FileResponse(
        file_path,
        media_type=content_type_for_filename(filename),
        filename=filename,
    )
