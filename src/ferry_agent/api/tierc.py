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
from ferry_agent.models import DeliveryJob, DeliveryStatus, Device, LibraryItem
from ferry_agent.services import conversion_profiles, converters, tierc
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
    device = None
    if job is not None:
        item_result = await db.execute(select(LibraryItem).where(LibraryItem.id == job.library_item_id))
        item = item_result.scalar_one_or_none()
        device_result = await db.execute(select(Device).where(Device.id == job.device_id))
        device = device_result.scalar_one_or_none()
    if job is None or item is None or device is None:
        return HTMLResponse(tierc.render_missing(), status_code=404)

    target_format = (job.target_format or item.original_format).lower().lstrip(".")
    preset = conversion_profiles.resolve_preset_id(device.conversion_profile)
    try:
        file_path, _cached = await converters.materialize_target_format(
            library_item_id=item.id,
            src_path=item.storage_path,
            original_format=item.original_format,
            target_format=target_format,
            preset=preset,
        )
    except Exception:
        return HTMLResponse(tierc.render_missing(), status_code=404)

    if Path(file_path).suffix.lstrip(".").lower() != target_format:
        return HTMLResponse(tierc.render_missing(), status_code=404)

    if short_code.downloads_left is not None:
        short_code.downloads_left -= 1
    job.status = DeliveryStatus.delivered
    job.delivered_at = datetime.now(timezone.utc)
    await db.commit()

    filename = Path(file_path).name
    return FileResponse(
        file_path,
        media_type=content_type_for_filename(filename),
        filename=filename,
    )
