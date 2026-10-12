"""Catalogue OPDS public (`/opds/...`) et gestion des jetons (`/api/v1/opds`).

Auth catalogue : jeton dans le chemin ou mot de passe Basic. Jeton inutilisable → 404. Rate limit par IP sur tout le prefixe `/opds/`.
"""

from __future__ import annotations

import base64
import binascii
import uuid
from pathlib import Path
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.api.response_contracts import COVER_RESPONSES, FILE_RESPONSES, content_response
from ferry_agent.db import get_db
from ferry_agent.models import LibraryItem, OpdsToken
from ferry_agent.schemas import OpdsTokenCreate, OpdsTokenCreated, OpdsTokenOut, OpdsTokenRevoke
from ferry_agent.services import opds as opds_service
from ferry_agent.services.covers import embedded_cover, fetch_cover_to_cache, validate_cover_url
from ferry_agent.services.file_validation import content_type_for_filename
from ferry_agent.services.library import user_facing_filename
from ferry_agent.services.rate_limit import opds_rate_limiter

catalog_router = APIRouter(prefix="/opds", tags=["opds"])
_path_catalog_router = APIRouter()
tokens_router = APIRouter(prefix="/api/v1/opds", tags=["opds-tokens"])


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _enforce_rate_limit(request: Request) -> None:
    if not opds_rate_limiter.allow(_client_key(request)):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="trop de requetes OPDS, reessayez plus tard",
        )


async def _require_token(raw_token: str, db: AsyncSession, request: Request) -> OpdsToken:
    authorization = request.headers.get("authorization")
    if authorization is not None:
        try:
            scheme, encoded = authorization.split(" ", 1)
            if scheme.lower() != "basic":
                raise ValueError
            decoded = base64.b64decode(encoded, validate=True).decode("utf-8")
            _username, raw_token = decoded.split(":", 1)
        except (ValueError, UnicodeError, binascii.Error):
            raise HTTPException(status_code=404, detail="introuvable") from None
    if not raw_token:
        raise HTTPException(status_code=404, detail="introuvable")
    row = await opds_service.resolve_token(db, raw_token)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="introuvable")
    return row


def _atom_response(body: bytes, content_type: str) -> Response:
    return Response(content=body, media_type=content_type)


# ---------------------------------------------------------------------------
# Gestion des jetons (auth utilisateur)
# ---------------------------------------------------------------------------


@tokens_router.post("/tokens", response_model=OpdsTokenCreated, status_code=status.HTTP_201_CREATED)
async def create_opds_token(
    payload: OpdsTokenCreate | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OpdsTokenCreated:
    payload = payload or OpdsTokenCreate()
    row, raw = await opds_service.create_token(
        db, user.id, payload.label,
        max_downloads=payload.max_downloads, expires_in_days=payload.expires_in_days,
    )
    return OpdsTokenCreated(
        id=row.id,
        label=row.label,
        token=raw,
        url=opds_service.public_catalog_url(raw),
        created_at=row.created_at,
        max_downloads=row.max_downloads,
        downloads_count=row.downloads_count,
        expires_at=row.expires_at,
        last_used_at=row.last_used_at,
    )


@tokens_router.get("/tokens", response_model=list[OpdsTokenOut])
async def list_opds_tokens(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[OpdsTokenOut]:
    rows = await opds_service.list_tokens(db, user.id)
    return [OpdsTokenOut.model_validate(row) for row in rows]


@tokens_router.post("/tokens/revoke", response_model=OpdsTokenOut)
async def revoke_opds_token(
    payload: OpdsTokenRevoke,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OpdsTokenOut:
    result = await db.execute(
        select(OpdsToken).where(
            OpdsToken.id == payload.token_id,
            OpdsToken.user_id == user.id,
            OpdsToken.revoked_at.is_(None),
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="jeton introuvable")
    await opds_service.revoke_token(db, row)
    return OpdsTokenOut.model_validate(row)


# ---------------------------------------------------------------------------
# Catalogue public
# ---------------------------------------------------------------------------


@_path_catalog_router.get(
    "/{token}",
    response_class=Response,
    responses=content_response(opds_service.NAV_CONTENT_TYPE),
)
async def opds_root(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    _enforce_rate_limit(request)
    await _require_token(token, db, request)
    return _atom_response(opds_service.build_root_navigation(token), opds_service.NAV_CONTENT_TYPE)


@_path_catalog_router.get(
    "/{token}/all",
    response_class=Response,
    responses=content_response(opds_service.ACQ_CONTENT_TYPE),
)
async def opds_all(
    token: str,
    request: Request,
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _enforce_rate_limit(request)
    row = await _require_token(token, db, request)
    total = await opds_service.count_items(db, row.user_id)
    items = await opds_service.list_items_page(db, row.user_id, page=page)
    base = opds_service.catalog_base_url(token)
    self_href = f"{base}/all?{urlencode({'page': page})}"
    body = opds_service.build_acquisition_feed(
        token=token,
        title="Toute la bibliothèque",
        self_href=self_href,
        items=items,
        page=page,
        total=total,
    )
    return _atom_response(body, opds_service.ACQ_CONTENT_TYPE)


@_path_catalog_router.get(
    "/{token}/recent",
    response_class=Response,
    responses=content_response(opds_service.ACQ_CONTENT_TYPE),
)
async def opds_recent(
    token: str,
    request: Request,
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _enforce_rate_limit(request)
    row = await _require_token(token, db, request)
    total = await opds_service.count_items(db, row.user_id)
    items = await opds_service.list_items_page(
        db, row.user_id, page=page, order_by_added=True
    )
    base = opds_service.catalog_base_url(token)
    self_href = f"{base}/recent?{urlencode({'page': page})}"
    body = opds_service.build_acquisition_feed(
        token=token,
        title="Ajouts récents",
        self_href=self_href,
        items=items,
        page=page,
        total=total,
    )
    return _atom_response(body, opds_service.ACQ_CONTENT_TYPE)


@_path_catalog_router.get(
    "/{token}/authors",
    response_class=Response,
    responses=content_response(opds_service.NAV_CONTENT_TYPE),
)
async def opds_authors(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    _enforce_rate_limit(request)
    row = await _require_token(token, db, request)
    authors = await opds_service.list_distinct_authors(db, row.user_id)
    return _atom_response(
        opds_service.build_authors_navigation(token, authors),
        opds_service.NAV_CONTENT_TYPE,
    )


@_path_catalog_router.get(
    "/{token}/author",
    response_class=Response,
    responses=content_response(opds_service.ACQ_CONTENT_TYPE),
)
async def opds_by_author(
    token: str,
    request: Request,
    name: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _enforce_rate_limit(request)
    row = await _require_token(token, db, request)
    total = await opds_service.count_items(db, row.user_id, author=name)
    items = await opds_service.list_items_page(
        db, row.user_id, page=page, author=name
    )
    base = opds_service.catalog_base_url(token)
    self_href = f"{base}/author?{urlencode({'name': name, 'page': page})}"
    body = opds_service.build_acquisition_feed(
        token=token,
        title=name,
        self_href=self_href,
        items=items,
        page=page,
        total=total,
        query_extra={"name": name},
    )
    return _atom_response(body, opds_service.ACQ_CONTENT_TYPE)


@_path_catalog_router.get(
    "/{token}/search",
    response_class=Response,
    responses=content_response(opds_service.ACQ_CONTENT_TYPE),
)
async def opds_search(
    token: str,
    request: Request,
    q: str = Query(""),
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _enforce_rate_limit(request)
    row = await _require_token(token, db, request)
    query = q.strip()
    total = await opds_service.count_items(db, row.user_id, query=query or None)
    items = await opds_service.list_items_page(
        db, row.user_id, page=page, query=query or None
    )
    base = opds_service.catalog_base_url(token)
    self_href = f"{base}/search?{urlencode({'q': query, 'page': page})}"
    body = opds_service.build_acquisition_feed(
        token=token,
        title=f"Recherche : {query}" if query else "Recherche",
        self_href=self_href,
        items=items,
        page=page,
        total=total,
        query_extra={"q": query},
    )
    return _atom_response(body, opds_service.ACQ_CONTENT_TYPE)


@_path_catalog_router.get(
    "/{token}/opensearch.xml",
    response_class=Response,
    responses=content_response(opds_service.OPENSEARCH_CONTENT_TYPE),
)
async def opds_opensearch(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    _enforce_rate_limit(request)
    await _require_token(token, db, request)
    return _atom_response(
        opds_service.build_opensearch_description(token),
        opds_service.OPENSEARCH_CONTENT_TYPE,
    )


@_path_catalog_router.get("/{token}/download/{item_id}", response_class=FileResponse, responses=FILE_RESPONSES)
async def opds_download(
    token: str,
    item_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    _enforce_rate_limit(request)
    row = await _require_token(token, db, request)
    result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.id == item_id,
            LibraryItem.user_id == row.user_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None or not item.storage_path or not Path(item.storage_path).is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="introuvable")
    if not await opds_service.consume_download(db, row.id):
        raise HTTPException(status_code=404, detail="introuvable")
    filename = user_facing_filename(item, item.original_format)
    return FileResponse(
        item.storage_path,
        media_type=content_type_for_filename(filename),
        filename=filename,
    )


@_path_catalog_router.get("/{token}/cover/{item_id}", response_class=Response, responses=COVER_RESPONSES)
async def opds_cover(
    token: str,
    item_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Sert la couverture via le meme proxy allowliste que `/api/v1/covers`."""
    _enforce_rate_limit(request)
    row = await _require_token(token, db, request)
    result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.id == item_id,
            LibraryItem.user_id == row.user_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None or not item.cover_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="introuvable")
    local = embedded_cover(item)
    if local is not None:
        path, media_type = local
        return FileResponse(path, media_type=media_type)
    cover = item.cover_url
    if cover.startswith("http://") or cover.startswith("https://"):
        cover_url = validate_cover_url(cover)
        if cover_url is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="introuvable")
        try:
            path, media_type = await fetch_cover_to_cache(str(item.id), cover_url)
        except (httpx.HTTPError, ValueError):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="introuvable")
        return FileResponse(path, media_type=media_type)
    path = Path(cover)
    if path.is_file():
        return FileResponse(path, media_type=content_type_for_filename(path.name))
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="introuvable")


# Register Basic paths before /{token}, which would otherwise match /all, /recent, etc.
@catalog_router.get("", response_class=Response, responses=content_response(opds_service.NAV_CONTENT_TYPE))
@catalog_router.get("/", response_class=Response, include_in_schema=False)
async def basic_root(request: Request, db: AsyncSession = Depends(get_db)) -> Response:
    return await opds_root(token="", request=request, db=db)


@catalog_router.get("/all", response_class=Response, responses=content_response(opds_service.ACQ_CONTENT_TYPE))
async def basic_all(request: Request, page: int = Query(1, ge=1), db: AsyncSession = Depends(get_db)) -> Response:
    return await opds_all(token="", request=request, page=page, db=db)


@catalog_router.get("/recent", response_class=Response, responses=content_response(opds_service.ACQ_CONTENT_TYPE))
async def basic_recent(request: Request, page: int = Query(1, ge=1), db: AsyncSession = Depends(get_db)) -> Response:
    return await opds_recent(token="", request=request, page=page, db=db)


@catalog_router.get("/authors", response_class=Response, responses=content_response(opds_service.NAV_CONTENT_TYPE))
async def basic_authors(request: Request, db: AsyncSession = Depends(get_db)) -> Response:
    return await opds_authors(token="", request=request, db=db)


@catalog_router.get("/author", response_class=Response, responses=content_response(opds_service.ACQ_CONTENT_TYPE))
async def basic_author(
    request: Request, name: str = Query(..., min_length=1), page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
) -> Response:
    return await opds_by_author(token="", request=request, name=name, page=page, db=db)


@catalog_router.get("/search", response_class=Response, responses=content_response(opds_service.ACQ_CONTENT_TYPE))
async def basic_search(
    request: Request, q: str = Query(""), page: int = Query(1, ge=1), db: AsyncSession = Depends(get_db),
) -> Response:
    return await opds_search(token="", request=request, q=q, page=page, db=db)


@catalog_router.get("/opensearch.xml", response_class=Response,
                    responses=content_response(opds_service.OPENSEARCH_CONTENT_TYPE))
async def basic_opensearch(request: Request, db: AsyncSession = Depends(get_db)) -> Response:
    return await opds_opensearch(token="", request=request, db=db)


@catalog_router.get("/download/{item_id}", response_class=FileResponse, responses=FILE_RESPONSES)
async def basic_download(item_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db)) -> FileResponse:
    return await opds_download(token="", item_id=item_id, request=request, db=db)


@catalog_router.get("/cover/{item_id}", response_class=Response, responses=COVER_RESPONSES)
async def basic_cover(item_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db)) -> Response:
    return await opds_cover(token="", item_id=item_id, request=request, db=db)


catalog_router.include_router(_path_catalog_router)
