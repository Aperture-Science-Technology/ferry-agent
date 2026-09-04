"""Lecture des liseuses (devices) de l'utilisateur courant + linking OAuth
cloud (tier B : Dropbox / Google Drive, voir services/cloud_links.py).
"""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.config import get_settings
from ferry_agent.db import get_db
from ferry_agent.models import Device, DeviceBrand, DeliveryTier
from ferry_agent.schemas import DeviceCreate, DeviceLinkCallback, DeviceLinkUrlOut, DeviceOut, DevicePatch
from ferry_agent.services import cloud_links
from ferry_agent.services import devices as device_service

# Mapping brand → tier par défaut (peut être affiné par modèle)
_KOBO_HIGH_END = {"forma", "sage", "elipsa", "libra colour", "libra color"}


def _compute_tier(brand: DeviceBrand, model: str | None) -> DeliveryTier:
    if brand == DeviceBrand.kindle:
        return DeliveryTier.A
    if brand == DeviceBrand.kobo:
        m = (model or "").lower()
        if any(name in m for name in _KOBO_HIGH_END):
            return DeliveryTier.B
        return DeliveryTier.C
    if brand == DeviceBrand.tolino:
        return DeliveryTier.C
    return DeliveryTier.D

router = APIRouter(prefix="/api/v1/devices", tags=["devices"])

_PROVIDERS = ("dropbox", "drive")


@router.post("", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
async def create_device(
    payload: DeviceCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeviceOut:
    """Crée un Device pour l'utilisateur ; calcule delivery_tier selon la marque/modèle."""
    tier = _compute_tier(payload.brand, payload.model)
    device = Device(
        user_id=user.id,
        name=payload.name,
        brand=payload.brand,
        model=payload.model,
        delivery_tier=tier,
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return DeviceOut.model_validate(device)


@router.get("", response_model=list[DeviceOut])
async def list_devices(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DeviceOut]:
    result = await db.execute(select(Device).where(Device.user_id == user.id))
    devices = result.scalars().all()
    return [DeviceOut.model_validate(d) for d in devices]


async def _get_owned_device(db: AsyncSession, device_id: uuid.UUID, user: CurrentUser) -> Device:
    result = await db.execute(select(Device).where(Device.id == device_id, Device.user_id == user.id))
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="device introuvable")
    return device


@router.patch("/{device_id}", response_model=DeviceOut)
async def update_device(
    device_id: uuid.UUID,
    payload: DevicePatch,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeviceOut:
    """Met a jour le nom/marque/modele d'un device ; recalcule delivery_tier
    si la marque ou le modele changent (jamais choisi a la main)."""
    device = await _get_owned_device(db, device_id, user)
    # exclude_unset seul : un champ explicitement envoye a `null` (ex. pour
    # effacer le nom ou le modele) doit etre applique. `exclude_defaults`
    # casserait ce cas car `None` est aussi la valeur par defaut du champ.
    updates = payload.model_dump(exclude_unset=True)

    brand_or_model_changed = "brand" in updates or "model" in updates
    for field, value in updates.items():
        setattr(device, field, value)

    if brand_or_model_changed:
        device.delivery_tier = _compute_tier(device.brand, device.model)

    await db.commit()
    await db.refresh(device)
    return DeviceOut.model_validate(device)


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    device = await _get_owned_device(db, device_id, user)
    await device_service.delete_device(db, device)


def _check_provider(provider: str) -> None:
    if provider not in _PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="provider doit etre 'dropbox' ou 'drive'"
        )


@router.get("/{device_id}/link", response_model=DeviceLinkUrlOut)
async def get_link_url(
    device_id: uuid.UUID,
    provider: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeviceLinkUrlOut:
    """URL d'autorisation OAuth a afficher a l'utilisateur pour relier son
    Dropbox/Google Drive a ce device."""
    _check_provider(provider)
    await _get_owned_device(db, device_id, user)
    settings = get_settings()

    if provider == "dropbox":
        if not settings.dropbox_client_id:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Dropbox non configure (DROPBOX_CLIENT_ID manquant)",
            )
        redirect_uri = settings.dropbox_redirect_uri.format(id=device_id)
        url = cloud_links.dropbox_authorize_url(settings.dropbox_client_id, redirect_uri)
    else:
        if not settings.google_client_id:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google Drive non configure (GOOGLE_CLIENT_ID manquant)",
            )
        redirect_uri = settings.google_redirect_uri.format(id=device_id)
        url = cloud_links.drive_authorize_url(settings.google_client_id, redirect_uri)

    return DeviceLinkUrlOut(url=url)


@router.post("/{device_id}/link/callback", response_model=DeviceOut)
async def link_callback(
    device_id: uuid.UUID,
    payload: DeviceLinkCallback,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeviceOut:
    """Echange le code OAuth contre un token et le stocke sur le device."""
    _check_provider(payload.provider)
    device = await _get_owned_device(db, device_id, user)
    settings = get_settings()

    try:
        if payload.provider == "dropbox":
            if not settings.dropbox_client_id or not settings.dropbox_client_secret:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Dropbox non configure (DROPBOX_CLIENT_ID/DROPBOX_CLIENT_SECRET manquants)",
                )
            redirect_uri = settings.dropbox_redirect_uri.format(id=device_id)
            tokens = await cloud_links.exchange_dropbox_code(
                payload.code, settings.dropbox_client_id, settings.dropbox_client_secret, redirect_uri
            )
            access_token = tokens.get("access_token")
            if not access_token:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY, detail="reponse Dropbox sans access_token"
                )
            link_ref = {"provider": "dropbox", "token": access_token}
        else:
            if not settings.google_client_id or not settings.google_client_secret:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Google Drive non configure (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET manquants)",
                )
            redirect_uri = settings.google_redirect_uri.format(id=device_id)
            tokens = await cloud_links.exchange_drive_code(
                payload.code, settings.google_client_id, settings.google_client_secret, redirect_uri
            )
            refresh_token = tokens.get("refresh_token")
            if not refresh_token:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY, detail="reponse Google sans refresh_token"
                )
            link_ref = {"provider": "drive", "refresh_token": refresh_token}
    except cloud_links.CloudLinkError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    device.link_ref = json.dumps(link_ref)
    await db.commit()
    await db.refresh(device)
    return DeviceOut.model_validate(device)
