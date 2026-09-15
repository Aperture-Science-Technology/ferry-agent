"""Profil de l'utilisateur courant (lecture + mise à jour partielle)."""

from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.db import get_db
from ferry_agent.models import User
from ferry_agent.schemas import UserOut, UserPatch
from ferry_agent.services.errors import (
    INVALID_DEFAULT_FORMAT_MESSAGE,
    INVALID_KINDLE_EMAIL_MESSAGE,
)

router = APIRouter(prefix="/api/v1/users", tags=["users"])


def _friendly_user_patch_detail(exc: ValidationError) -> str:
    """Transforme une ValidationError pydantic en message utilisateur simple."""
    for err in exc.errors():
        loc = err.get("loc") or ()
        if "kindle_email" in loc:
            return INVALID_KINDLE_EMAIL_MESSAGE
        if "default_format" in loc:
            return INVALID_DEFAULT_FORMAT_MESSAGE
        msg = err.get("msg")
        if isinstance(msg, str) and msg:
            return msg
    return "Requête invalide."


@router.get("/me", response_model=UserOut)
async def get_me(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    db_user = await db.get(User, user.id)
    return UserOut.model_validate(db_user)


@router.patch("/me", response_model=UserOut)
async def patch_me(
    body: dict = Body(...),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Mise a jour partielle : champ absent = inchange ; ``null`` = efface.

    Le corps est valide manuellement pour renvoyer un ``detail`` 422 en texte
    simple (charte non-tech), au lieu du tableau pydantic brut.
    """
    try:
        payload = UserPatch.model_validate(body)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=_friendly_user_patch_detail(exc),
        ) from exc

    db_user = await db.get(User, user.id)
    # exclude_unset seul : un champ omit ne doit pas etre touche ; un champ
    # explicitement null (ex. effacer kindle_email) doit etre applique.
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_user, key, value)
    await db.commit()
    await db.refresh(db_user)
    return UserOut.model_validate(db_user)
