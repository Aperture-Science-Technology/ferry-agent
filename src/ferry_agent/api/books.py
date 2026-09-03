"""Recherche et ajout de livres a la bibliotheque de l'utilisateur courant."""

import asyncio
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.config import get_settings
from ferry_agent.db import get_db
from ferry_agent.models import Gateway, GatewayJobStatus, GatewayJobType, PairingStatus
from ferry_agent.schemas import (
    GatewayFetchQueued,
    LibraryItemOut,
    Result,
    ResultOut,
    SearchRequest,
)
from ferry_agent.services import gateways as gateway_service
from ferry_agent.services import library

router = APIRouter(prefix="/api/v1/books", tags=["books"])


@router.get("", response_model=list[LibraryItemOut])
async def list_books(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[LibraryItemOut]:
    """Liste les LibraryItem de l'utilisateur courant."""
    from sqlalchemy import select as _select
    from ferry_agent.models import LibraryItem
    result = await db.execute(_select(LibraryItem).where(LibraryItem.user_id == user.id))
    items = result.scalars().all()
    return [LibraryItemOut.model_validate(item) for item in items]


@router.post("/search", response_model=list[ResultOut])
async def search_books(
    payload: SearchRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ResultOut]:
    scope = payload.scope or ["legal", "gateways"]
    results = []
    if "legal" in scope:
        results.extend(await library.search_all(payload.query))

    gateways = []
    if "gateways" in scope or any(value.startswith("gateway:") for value in scope):
        settings = get_settings()
        gateways = await gateway_service.online_gateways(
            db, user.id, settings.gateway_online_seconds
        )
        selected_ids = {
            value.removeprefix("gateway:")
            for value in scope
            if value.startswith("gateway:")
        }
        if "gateways" not in scope:
            gateways = [gateway for gateway in gateways if str(gateway.id) in selected_ids]

        jobs = [
            await gateway_service.create_job(
                db,
                gateway.id,
                GatewayJobType.search,
                {"query": payload.query},
            )
            for gateway in gateways
        ]
        deadline = asyncio.get_running_loop().time() + settings.gateway_search_wait_seconds
        while jobs and asyncio.get_running_loop().time() < deadline:
            for job in jobs:
                await db.refresh(job)
            if all(job.status in (GatewayJobStatus.done, GatewayJobStatus.failed) for job in jobs):
                break
            await asyncio.sleep(0.25)
        for job in jobs:
            if job.status == GatewayJobStatus.done:
                results.extend(Result.model_validate(item) for item in job.payload.get("results", []))

    return [ResultOut.model_validate(result) for result in results]


@router.post(
    "",
    response_model=LibraryItemOut | GatewayFetchQueued,
    status_code=status.HTTP_201_CREATED,
)
async def add_book(
    request: Request,
    response: Response,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LibraryItemOut | GatewayFetchQueued:
    """Ajoute un livre a la bibliotheque, soit via un connecteur (`source` +
    `result_id`), soit via un fichier deja possede par l'utilisateur
    (`file`, multipart). Exactement l'un des deux doit etre fourni.
    """
    content_type = request.headers.get("content-type", "")
    data: dict = {}
    file: UploadFile | None = None
    if content_type.startswith("application/json"):
        data = await request.json()
    else:
        form = await request.form()
        data = {key: value for key, value in form.items() if key != "file"}
        candidate = form.get("file")
        if candidate is not None and hasattr(candidate, "read"):
            file = candidate  # type: ignore[assignment]

    if file is not None:
        content = await file.read()
        item = await library.import_from_upload(db, user.id, file.filename or "book.epub", content)
        return LibraryItemOut.model_validate(item)

    source = data.get("source")
    result_id = data.get("result_id")
    if isinstance(source, str) and source.startswith("gateway:"):
        try:
            gateway_id = uuid.UUID(source.split(":", 1)[1])
        except (ValueError, IndexError) as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="source gateway invalide") from exc

        gateway_result = await db.execute(
            select(Gateway).where(
                Gateway.id == gateway_id,
                Gateway.user_id == user.id,
                Gateway.pairing_status == PairingStatus.paired,
            )
        )
        gateway = gateway_result.scalar_one_or_none()
        if gateway is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="gateway introuvable")

        raw_result = data.get("result")
        if isinstance(raw_result, str):
            try:
                raw_result = json.loads(raw_result)
            except json.JSONDecodeError as exc:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="result JSON invalide") from exc
        if not isinstance(raw_result, dict):
            raw_result = data
        raw_result = {
            **raw_result,
            "source": source,
            "result_id": raw_result.get("result_id") or result_id or "",
            "title": raw_result.get("title") or result_id or "Gateway book",
        }
        try:
            selected_result = Result.model_validate(raw_result)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
        if not (selected_result.magnet_url or selected_result.guid):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="le resultat gateway doit contenir magnet_url ou guid",
            )

        job = await gateway_service.create_job(
            db,
            gateway.id,
            GatewayJobType.fetch,
            {"result": selected_result.model_dump(mode="json")},
        )
        response.status_code = status.HTTP_202_ACCEPTED
        return GatewayFetchQueued(gateway_job_id=job.id, status=job.status)

    if source and result_id:
        try:
            item = await library.import_from_connector(db, user.id, source, result_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        return LibraryItemOut.model_validate(item)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="fournir soit 'file', soit 'source' + 'result_id'",
    )
