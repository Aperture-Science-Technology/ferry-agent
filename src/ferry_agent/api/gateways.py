"""API de peering et canal de travail des gateway-agents detaches."""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import CurrentUser, get_current_user, get_gateway
from ferry_agent.config import get_settings
from ferry_agent.db import get_db
from ferry_agent.models import Gateway, GatewayJob, GatewayJobStatus, GatewayJobType
from ferry_agent.schemas import (
    GatewayCreate,
    GatewayCredentials,
    GatewayFetchResult,
    GatewayId,
    GatewayJobAck,
    GatewayJobOut,
    GatewayJobStatusOut,
    GatewayOut,
    GatewayPair,
    GatewayRevoke,
    SearchResults,
)
from ferry_agent.services import gateways as gateway_service
from ferry_agent.services import library
from ferry_agent.services.errors import FileTooLargeError, UnknownFormatError
from ferry_agent.services.file_validation import read_limited, sniff_ebook_format
from ferry_agent.services.virustotal import is_known_malicious


router = APIRouter(prefix="/api/v1/gateways", tags=["gateways"])


@router.post("", response_model=GatewayCredentials, status_code=status.HTTP_201_CREATED)
async def create_gateway(
    payload: GatewayCreate | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GatewayCredentials:
    settings = get_settings()
    payload = payload or GatewayCreate()
    gateway, pairing_token, gateway_key = await gateway_service.create_gateway(
        db, user.id, payload.name, settings.pairing_token_ttl_minutes
    )
    return GatewayCredentials(
        gateway_id=gateway.id,
        pairing_token=pairing_token,
        gateway_key=gateway_key,
        pairing_expires_at=gateway.pairing_expires_at,
        pairing_token_ttl_minutes=settings.pairing_token_ttl_minutes,
        gateway_online_seconds=settings.gateway_online_seconds,
    )


@router.post("/pair", response_model=GatewayId)
async def pair_gateway(
    payload: GatewayPair,
    db: AsyncSession = Depends(get_db),
) -> GatewayId:
    gateway = await gateway_service.pair_gateway(db, payload.token)
    return GatewayId(gateway_id=gateway.id)


@router.get("", response_model=list[GatewayOut])
async def list_gateways(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GatewayOut]:
    settings = get_settings()
    result = await db.execute(select(Gateway).where(Gateway.user_id == user.id))
    return [
        GatewayOut.model_validate(gateway).model_copy(
            update={
                "pairing_token_ttl_minutes": settings.pairing_token_ttl_minutes,
                "gateway_online_seconds": settings.gateway_online_seconds,
            }
        )
        for gateway in result.scalars().all()
    ]


@router.post("/revoke", response_model=GatewayId)
async def revoke_gateway(
    payload: GatewayRevoke,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GatewayId:
    result = await db.execute(
        select(Gateway).where(Gateway.id == payload.gateway_id, Gateway.user_id == user.id)
    )
    gateway = result.scalar_one_or_none()
    if gateway is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="gateway introuvable")
    await gateway_service.revoke_gateway(db, gateway)
    return GatewayId(gateway_id=gateway.id)


@router.delete("/{gateway_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gateway(
    gateway_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Gateway).where(Gateway.id == gateway_id, Gateway.user_id == user.id)
    )
    gateway = result.scalar_one_or_none()
    if gateway is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="gateway introuvable")
    await gateway_service.delete_gateway(db, gateway)


@router.post("/poll", response_model=GatewayJobOut | None)
async def poll_gateway(
    gateway: Gateway = Depends(get_gateway),
    db: AsyncSession = Depends(get_db),
) -> GatewayJobOut | Response:
    job = await gateway_service.poll_job(db, gateway.id)
    if job is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return GatewayJobOut.model_validate(job)


@router.post("/jobs/{job_id}/search-results", response_model=GatewayJobAck)
async def submit_search_results(
    job_id: uuid.UUID,
    payload: SearchResults,
    gateway: Gateway = Depends(get_gateway),
    db: AsyncSession = Depends(get_db),
) -> GatewayJobAck:
    job = await gateway_service.get_gateway_job(
        db, gateway.id, job_id, GatewayJobType.search
    )
    normalized = [
        result.model_copy(update={"source": f"gateway:{gateway.id}"})
        for result in payload.root
    ]
    job = await gateway_service.save_search_results(db, job, normalized)
    return GatewayJobAck(job_id=job.id, status=job.status)


@router.post("/jobs/{job_id}/fetch-result", response_model=GatewayFetchResult)
async def submit_fetch_result(
    job_id: uuid.UUID,
    file: UploadFile = File(...),
    gateway: Gateway = Depends(get_gateway),
    db: AsyncSession = Depends(get_db),
) -> GatewayFetchResult:
    job = await gateway_service.get_gateway_job(
        db, gateway.id, job_id, GatewayJobType.fetch
    )
    if job.status == GatewayJobStatus.done and job.result_ref:
        return GatewayFetchResult(library_item_id=uuid.UUID(job.result_ref))
    if job.status not in (GatewayJobStatus.pending, GatewayJobStatus.running):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="gateway job non actif")

    settings = get_settings()
    try:
        content = await read_limited(file, settings.max_fetch_bytes)
        detected_format = sniff_ebook_format(content)
    except FileTooLargeError as exc:
        job.status = GatewayJobStatus.failed
        job.result_ref = str(exc)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)
        ) from exc
    except UnknownFormatError as exc:
        job.status = GatewayJobStatus.failed
        job.result_ref = str(exc)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    if await is_known_malicious(content, settings.virustotal_api_key):
        job.status = GatewayJobStatus.failed
        job.result_ref = "fichier signale comme malveillant par VirusTotal"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=job.result_ref,
        )

    filename = file.filename or f"gateway-book.{detected_format}"
    if detected_format == "mobi" and Path(filename).suffix.lower() == ".azw3":
        detected_format = "azw3"
    metadata = job.payload.get("result", {})
    item = await library.import_from_gateway(
        db,
        gateway.user_id,
        gateway.id,
        job.id,
        filename,
        content,
        detected_format,
        metadata,
    )
    job.status = GatewayJobStatus.done
    job.result_ref = str(item.id)
    await db.commit()
    return GatewayFetchResult(library_item_id=item.id)


def _gateway_job_status_out(job: GatewayJob) -> GatewayJobStatusOut:
    library_item_id = None
    error = None
    if job.type == GatewayJobType.fetch and job.status == GatewayJobStatus.done and job.result_ref:
        library_item_id = uuid.UUID(job.result_ref)
    elif job.status == GatewayJobStatus.failed:
        error = job.result_ref
    return GatewayJobStatusOut.model_validate(job).model_copy(
        update={"library_item_id": library_item_id, "error": error}
    )


@router.get("/jobs/{job_id}", response_model=GatewayJobStatusOut)
async def get_gateway_job_status(
    job_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GatewayJobStatusOut:
    result = await db.execute(
        select(GatewayJob)
        .join(Gateway, GatewayJob.gateway_id == Gateway.id)
        .where(GatewayJob.id == job_id, Gateway.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="gateway job introuvable")
    return _gateway_job_status_out(job)


@router.get("/{gateway_id}/jobs", response_model=list[GatewayJobStatusOut])
async def list_gateway_jobs(
    gateway_id: uuid.UUID,
    limit: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GatewayJobStatusOut]:
    gateway_result = await db.execute(
        select(Gateway).where(Gateway.id == gateway_id, Gateway.user_id == user.id)
    )
    if gateway_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="gateway introuvable")

    result = await db.execute(
        select(GatewayJob)
        .where(GatewayJob.gateway_id == gateway_id)
        .order_by(GatewayJob.created_at.desc())
        .limit(limit)
    )
    return [_gateway_job_status_out(job) for job in result.scalars().all()]
