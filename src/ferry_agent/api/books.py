"""Recherche et ajout de livres a la bibliotheque de l'utilisateur courant."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.db import get_db
from ferry_agent.schemas import LibraryItemOut, ResultOut, SearchRequest
from ferry_agent.services import library

router = APIRouter(prefix="/api/v1/books", tags=["books"])


@router.post("/search", response_model=list[ResultOut])
async def search_books(
    payload: SearchRequest,
    _user: CurrentUser = Depends(get_current_user),
) -> list[ResultOut]:
    results = await library.search_all(payload.query)
    return [ResultOut.model_validate(r) for r in results]


@router.post("", response_model=LibraryItemOut, status_code=status.HTTP_201_CREATED)
async def add_book(
    source: str | None = Form(default=None),
    result_id: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LibraryItemOut:
    """Ajoute un livre a la bibliotheque, soit via un connecteur (`source` +
    `result_id`), soit via un fichier deja possede par l'utilisateur
    (`file`, multipart). Exactement l'un des deux doit etre fourni.
    """
    if file is not None:
        content = await file.read()
        item = await library.import_from_upload(db, user.id, file.filename or "book.epub", content)
        return LibraryItemOut.model_validate(item)

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
