"""Recherche et ajout de livres a la bibliotheque de l'utilisateur courant."""

import asyncio
import json
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import CurrentUser, get_current_user, get_library_user
from ferry_agent.api.deliveries import _DELIVERY_LIST_COLS, build_delivery_out
from ferry_agent.config import get_settings
from ferry_agent.db import get_db
from ferry_agent.models import (
    DeliveryJob,
    Device,
    Gateway,
    GatewayJobStatus,
    GatewayJobType,
    LibraryItem,
    PairingStatus,
    Source,
    SourceType,
)
from ferry_agent.schemas import (
    DeliveryOut,
    GatewayFetchQueued,
    LibraryItemOut,
    LibraryItemUpdate,
    PaginatedLibraryItems,
    Result,
    ResultOut,
    SearchRequest,
)
from ferry_agent.services import gateways as gateway_service
from ferry_agent.services import library
from ferry_agent.services.covers import validate_cover_url
from ferry_agent.services.errors import FileTooLargeError, QuotaExceededError, UnknownFormatError
from ferry_agent.services.file_validation import read_limited, sniff_ebook_format
from ferry_agent.services.virustotal import is_known_malicious

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/books", tags=["books"])


def _normalize_isbn(value: str) -> str:
    """Normalise un ISBN pour comparaison (lowercase, espaces/tirets retires)."""
    return value.strip().lower().replace("-", "").replace(" ", "")


def _normalize_text(value: str | None) -> str:
    """Normalise un titre/auteur pour comparaison (lowercase, espaces, ponctuation finale)."""
    if not value:
        return ""
    text = " ".join(value.strip().lower().split())
    return text.rstrip(".,;:!?")


def _normalize_provider(value: SourceType | str | None) -> str | None:
    """Normalise un provider (source de resultat ou `Source.type` possede).

    Les gateways (`gateway:<uuid>` cote resultat, `torrent_gateway` cote
    `Source.type`) sont ramenes au meme provider `gateway` : l'utilisateur
    possede deja un livre depuis *son* gateway, peu importe lequel a servi la
    recherche.
    """
    if value is None:
        return None
    raw = value.value if isinstance(value, SourceType) else str(value)
    raw = raw.strip().lower()
    if raw.startswith("gateway:") or raw == SourceType.torrent_gateway.value:
        return "gateway"
    return raw


async def _import_uploaded_file(
    db: AsyncSession,
    user: CurrentUser,
    file: UploadFile,
) -> LibraryItemOut:
    """Valide, borne, controle le quota, puis persiste un ebook uploade."""
    settings = get_settings()
    try:
        content = await read_limited(file, settings.max_fetch_bytes)
        detected_format = sniff_ebook_format(content)
    except FileTooLargeError as exc:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)
        ) from exc
    except UnknownFormatError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    try:
        await library.ensure_storage_quota(db, user.id, len(content))
    except QuotaExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE, detail=str(exc)
        ) from exc

    if await is_known_malicious(content, settings.virustotal_api_key):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="fichier signale comme malveillant par VirusTotal",
        )

    safe_name = Path(file.filename or "book").name  # neutralise ../ et les chemins absolus
    item = await library.import_from_upload(
        db, user.id, safe_name, content, detected_format=detected_format
    )
    return LibraryItemOut.model_validate(item)


@router.post(
    "/upload",
    response_model=LibraryItemOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload d'un ebook",
)
async def upload_book(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_library_user),
    db: AsyncSession = Depends(get_db),
) -> LibraryItemOut:
    """Importe un fichier ebook (multipart `file`) dans la bibliotheque.

    Accepte l'auth utilisateur (Bearer Clerk / `X-Dev-User`) ou la cle
    gateway (`X-Gateway-Key`) pour un import au nom du proprio.
    """
    return await _import_uploaded_file(db, user, file)


@router.get("", response_model=PaginatedLibraryItems)
async def list_books(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedLibraryItems:
    """Liste paginee des LibraryItem de l'utilisateur courant (SQL limit/offset)."""
    total_result = await db.execute(
        select(func.count()).select_from(LibraryItem).where(LibraryItem.user_id == user.id)
    )
    total = int(total_result.scalar_one() or 0)
    offset = (page - 1) * limit
    result = await db.execute(
        select(LibraryItem)
        .where(LibraryItem.user_id == user.id)
        .order_by(LibraryItem.added_at.desc())
        .offset(offset)
        .limit(limit)
    )
    items = result.scalars().all()
    return PaginatedLibraryItems(
        items=[LibraryItemOut.model_validate(item) for item in items],
        total=total,
        page=page,
        limit=limit,
    )


@router.post("/search", response_model=list[ResultOut])
async def search_books(
    payload: SearchRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ResultOut]:
    scope = payload.scope or ["legal", "gateways"]
    results = []
    if "legal" in scope:
        disabled_result = await db.execute(
            select(Source.type).where(
                Source.user_id == user.id,
                Source.type.in_((SourceType.gutenberg, SourceType.standard_ebooks)),
                Source.enabled.is_(False),
            )
        )
        exclude = {source_type.value for source_type in disabled_result.scalars().all()}
        results.extend(await library.search_all(payload.query, exclude=exclude))

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

    owned_result = await db.execute(
        select(LibraryItem, Source.type)
        .outerjoin(Source, LibraryItem.source_id == Source.id)
        .where(LibraryItem.user_id == user.id)
    )
    owned_rows = owned_result.all()
    # Matching en couches :
    # 1. `source_ref` exact (`gutenberg:1342`) — identite canonique (mig 0008)
    # 2. ISBN normalise — editions partageant le meme ISBN
    # 3. titre + auteur + provider — filet quand ni ref ni ISBN ne sont
    #    disponibles (cas frequent cote gateway / indexeurs incomplets)
    owned_index: set[tuple[str | None, str, str]] = set()
    owned_isbns: set[str] = set()
    owned_refs: set[str] = set()
    for owned, source_type in owned_rows:
        provider = _normalize_provider(source_type)
        title = _normalize_text(owned.title)
        if title:
            owned_index.add((provider, title, _normalize_text(owned.author)))
        if owned.isbn:
            owned_isbns.add(_normalize_isbn(owned.isbn))
        if owned.source_ref:
            owned_refs.add(owned.source_ref)

    def _is_owned(result: Result) -> bool:
        result_ref = f"{result.source}:{result.result_id}"
        if result_ref in owned_refs:
            return True
        isbn = getattr(result, "isbn", None)
        if isbn and _normalize_isbn(isbn) in owned_isbns:
            return True
        provider = _normalize_provider(result.source)
        title = _normalize_text(result.title)
        author = _normalize_text(result.author)
        return (provider, title, author) in owned_index

    outs = []
    for result in results:
        out = ResultOut.model_validate(result)
        out.owned = _is_owned(result)
        out.cover_url = validate_cover_url(out.cover_url)
        outs.append(out)
    return outs


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

    La branche multipart est **deprecated** : preferer `POST /api/v1/books/upload`
    (conservee 1–2 releases pour compatibilite).
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
        logger.warning(
            "POST /api/v1/books multipart is deprecated; use POST /api/v1/books/upload"
        )
        response.headers["Deprecation"] = "true"
        response.headers["Link"] = '</api/v1/books/upload>; rel="successor-version"'
        return await _import_uploaded_file(db, user, file)

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
        # MCP add_to_library n'envoie que source + result_id : inferer la
        # reference de telechargement sans ecraser magnet_url/guid fournis.
        inferred_id = raw_result["result_id"]
        if not raw_result.get("magnet_url") and not raw_result.get("guid"):
            if inferred_id.startswith("magnet:"):
                raw_result["magnet_url"] = inferred_id
            elif inferred_id:
                raw_result["guid"] = inferred_id
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
        raw_metadata = data.get("result")
        if isinstance(raw_metadata, str):
            try:
                raw_metadata = json.loads(raw_metadata)
            except json.JSONDecodeError as exc:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="result JSON invalide") from exc
        metadata = raw_metadata if isinstance(raw_metadata, dict) else None
        try:
            item = await library.import_from_connector(
                db, user.id, source, result_id, metadata=metadata
            )
        except QuotaExceededError as exc:
            raise HTTPException(
                status_code=status.HTTP_507_INSUFFICIENT_STORAGE, detail=str(exc)
            ) from exc
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        return LibraryItemOut.model_validate(item)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="fournir soit 'file', soit 'source' + 'result_id'",
    )


async def _get_owned_item(db: AsyncSession, item_id: uuid.UUID, user: CurrentUser) -> LibraryItem:
    result = await db.execute(
        select(LibraryItem).where(LibraryItem.id == item_id, LibraryItem.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="introuvable")
    return item


@router.patch("/{item_id}", response_model=LibraryItemOut)
async def update_book(
    item_id: uuid.UUID,
    payload: LibraryItemUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LibraryItemOut:
    item = await _get_owned_item(db, item_id, user)
    # exclude_unset seul : un champ explicitement envoye a `null` (ex. pour
    # effacer l'ISBN, la description ou l'annee) doit etre applique. `exclude_defaults`
    # casserait ce cas car `None` est aussi la valeur par defaut du champ.
    update_payload = payload.model_dump(exclude_unset=True)
    for key, value in update_payload.items():
        setattr(item, key, value)
    await db.commit()
    await db.refresh(item)
    return LibraryItemOut.model_validate(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    item_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    item = await _get_owned_item(db, item_id, user)
    await library.delete_library_item(db, item)


@router.get("/{item_id}/deliveries", response_model=list[DeliveryOut])
async def list_book_deliveries(
    item_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DeliveryOut]:
    await _get_owned_item(db, item_id, user)
    result = await db.execute(
        select(*_DELIVERY_LIST_COLS)
        .join(Device, DeliveryJob.device_id == Device.id)
        .outerjoin(LibraryItem, DeliveryJob.library_item_id == LibraryItem.id)
        .where(DeliveryJob.library_item_id == item_id)
    )
    return [
        build_delivery_out(
            job,
            item_title=title,
            item_author=author,
            device_name=name,
            device_brand=brand,
            device_model=model,
        )
        for job, title, author, name, brand, model in result.all()
    ]
