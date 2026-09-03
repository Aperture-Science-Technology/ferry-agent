"""Routes publiques du mini-catalogue HTTP (tier C).

Pas d'authentification utilisateur : le code court fait office de jeton
d'acces a duree de vie limitee. Ces routes sont pensees pour un navigateur
embarque ancien (Kobo/Tolino ~ Chromium Android 4) : HTML minimal, aucun
JavaScript.
"""

from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.db import get_db
from ferry_agent.models import DeliveryJob, DeliveryStatus, LibraryItem
from ferry_agent.services import tierc
from ferry_agent.services.file_validation import content_type_for_filename

router = APIRouter(prefix="/c", tags=["tier-c"])


@router.get("/{code}")
async def get_catalog_page(code: str, db: AsyncSession = Depends(get_db)) -> HTMLResponse:
    short_code = await tierc.get_valid_short_code(db, code)
    if short_code is None:
        return HTMLResponse(tierc.render_missing(), status_code=404)

    item_result = await db.execute(
        select(LibraryItem)
        .join(DeliveryJob, DeliveryJob.library_item_id == LibraryItem.id)
        .where(DeliveryJob.id == short_code.delivery_job_id)
    )
    item = item_result.scalar_one_or_none()
    title = item.title if item else "Livre"
    author = item.author if item else ""
    return HTMLResponse(tierc.render_page(short_code.code, title, author))


@router.get("/{code}/download")
async def download(code: str, db: AsyncSession = Depends(get_db)):
    short_code = await tierc.get_valid_short_code(db, code)
    if short_code is None:
        return HTMLResponse(tierc.render_missing(), status_code=404)

    job_result = await db.execute(select(DeliveryJob).where(DeliveryJob.id == short_code.delivery_job_id))
    job = job_result.scalar_one_or_none()
    item = None
    if job is not None:
        item_result = await db.execute(select(LibraryItem).where(LibraryItem.id == job.library_item_id))
        item = item_result.scalar_one_or_none()
    if job is None or item is None:
        return HTMLResponse(tierc.render_missing(), status_code=404)

    if short_code.downloads_left is not None:
        short_code.downloads_left -= 1
    job.status = DeliveryStatus.delivered
    job.delivered_at = datetime.now(timezone.utc)
    await db.commit()

    filename = Path(item.storage_path).name
    return FileResponse(
        item.storage_path,
        media_type=content_type_for_filename(filename),
        filename=filename,
    )
