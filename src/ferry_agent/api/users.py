"""Profil de l'utilisateur courant (lecture + mise à jour partielle)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.db import get_db
from ferry_agent.models import User
from ferry_agent.schemas import UserOut, UserPatch

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def get_me(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    db_user = await db.get(User, user.id)
    return UserOut.model_validate(db_user)


@router.patch("/me", response_model=UserOut)
async def patch_me(
    payload: UserPatch,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    db_user = await db.get(User, user.id)
    if payload.kindle_email is not None:
        db_user.kindle_email = payload.kindle_email
    if payload.default_format is not None:
        db_user.default_format = payload.default_format
    await db.commit()
    await db.refresh(db_user)
    return UserOut.model_validate(db_user)
