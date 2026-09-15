"""Catalogue OPDS public (`/opds/...`) et gestion des jetons (`/api/v1/opds`).

Auth catalogue : jeton dans le chemin (pas de Basic). Jeton inconnu ou
revoque → 404 (pas 403). Rate limit par IP sur tout le prefixe `/opds/`.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.db import get_db
from ferry_agent.models import LibraryItem, OpdsToken
from ferry_agent.schemas import OpdsTokenCreate, OpdsTokenCreated, OpdsTokenOut, OpdsTokenRevoke
from ferry_agent.services import opds as opds_service
from ferry_agent.services.covers import fetch_cover_to_cache, validate_cover_url
from ferry_agent.services.file_validation import content_type_for_filename
from ferry_agent.services.rate_limit import opds_rate_limiter

catalog_router = APIRouter(prefix="/opds", tags=["opds"])
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


async def _require_token(raw_token: str, db: AsyncSession) -> OpdsToken:
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
    row, raw = await opds_service.create_token(db, user.id, payload.label)
    return OpdsTokenCreated(
        id=row.id,
        label=row.label,
        token=raw,
        url=opds_service.public_catalog_url(raw),
        created_at=row.created_at,
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


@catalog_router.get("/{token}")
async def opds_root(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    _enforce_rate_limit(request)
    await _require_token(token, db)
    return _atom_response(opds_service.build_root_navigation(token), opds_service.NAV_CONTENT_TYPE)


@catalog_router.get("/{token}/all")
async def opds_all(
    token: str,
    request: Request,
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _enforce_rate_limit(request)
    row = await _require_token(token, db)
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


@catalog_router.get("/{token}/recent")
async def opds_recent(
    token: str,
    request: Request,
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _enforce_rate_limit(request)
    row = await _require_token(token, db)
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


@catalog_router.get("/{token}/authors")
async def opds_authors(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    _enforce_rate_limit(request)
    row = await _require_token(token, db)
    authors = await opds_service.list_distinct_authors(db, row.user_id)
    return _atom_response(
        opds_service.build_authors_navigation(token, authors),
        opds_service.NAV_CONTENT_TYPE,
    )


@catalog_router.get("/{token}/author")
async def opds_by_author(
    token: str,
    request: Request,
    name: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _enforce_rate_limit(request)
    row = await _require_token(token, db)
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


@catalog_router.get("/{token}/search")
async def opds_search(
    token: str,
    request: Request,
    q: str = Query(""),
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _enforce_rate_limit(request)
    row = await _require_token(token, db)
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


@catalog_router.get("/{token}/opensearch.xml")
async def opds_opensearch(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    _enforce_rate_limit(request)
    await _require_token(token, db)
    return _atom_response(
        opds_service.build_opensearch_description(token),
        opds_service.OPENSEARCH_CONTENT_TYPE,
    )


@catalog_router.get("/{token}/download/{item_id}")
async def opds_download(
    token: str,
    item_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    _enforce_rate_limit(request)
    row = await _require_token(token, db)
    result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.id == item_id,
            LibraryItem.user_id == row.user_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None or not item.storage_path or not Path(item.storage_path).is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="introuvable")
    filename = Path(item.storage_path).name
    return FileResponse(
        item.storage_path,
        media_type=content_type_for_filename(filename),
        filename=filename,
    )


@catalog_router.get("/{token}/cover/{item_id}")
async def opds_cover(
    token: str,
    item_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Sert la couverture via le meme proxy allowliste que `/api/v1/covers`."""
    _enforce_rate_limit(request)
    row = await _require_token(token, db)
    result = await db.execute(
        select(LibraryItem).where(
            LibraryItem.id == item_id,
            LibraryItem.user_id == row.user_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None or not item.cover_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="introuvable")
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
