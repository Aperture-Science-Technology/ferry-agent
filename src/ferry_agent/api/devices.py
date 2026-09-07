"""Lecture des liseuses (devices) de l'utilisateur courant + linking OAuth
cloud (tier B : Dropbox / Google Drive, voir services/cloud_links.py).
"""

import logging
import uuid
from typing import Literal
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ferry_agent.api.deps import CurrentUser, get_current_user
from ferry_agent.config import get_settings
from ferry_agent.db import get_db
from ferry_agent.models import Device, DeviceBrand, DeliveryTier
from ferry_agent.schemas import DeviceCreate, DeviceLinkCallback, DeviceLinkUrlOut, DeviceOut, DevicePatch
from ferry_agent.services import cloud_links
from ferry_agent.services import conversion_profiles
from ferry_agent.services import crypto
from ferry_agent.services import devices as device_service
from ferry_agent.services import mailer
from ferry_agent.services.delivery_methods import MethodAvailability, available_delivery_methods

logger = logging.getLogger(__name__)

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


def _device_out(device: Device) -> DeviceOut:
    """Expose l'état de liaison cloud sans jamais renvoyer le JSON link_ref (tokens)."""
    cloud_provider: Literal["dropbox", "drive"] | None = None
    cloud_linked = False
    if device.link_ref:
        try:
            parsed = cloud_links.parse_link_ref(device.link_ref)
            provider = parsed["provider"]
            if provider in ("dropbox", "drive"):
                cloud_provider = provider
                cloud_linked = True
        except cloud_links.CloudLinkError:
            # Cle perdue / jeton corrompu : degrade proprement, jamais 500.
            pass
    return DeviceOut(
        id=device.id,
        name=device.name,
        brand=device.brand,
        model=device.model,
        delivery_tier=device.delivery_tier,
        conversion_profile=conversion_profiles.resolve_preset_id(device.conversion_profile),
        cloud_provider=cloud_provider,
        cloud_linked=cloud_linked,
        last_synced_at=device.last_synced_at,
    )


def _dashboard_redirect(status_value: str) -> RedirectResponse:
    settings = get_settings()
    query = urlencode({"cloud_link": status_value})
    # Locale par defaut du front (next-intl) : /fr/...
    target = f"{settings.public_base_url.rstrip('/')}/fr/app/appareils?{query}"
    return RedirectResponse(url=target, status_code=status.HTTP_302_FOUND)


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
        conversion_profile=conversion_profiles.to_storage(payload.conversion_profile),
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return _device_out(device)


@router.get("", response_model=list[DeviceOut])
async def list_devices(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DeviceOut]:
    result = await db.execute(select(Device).where(Device.user_id == user.id))
    devices = result.scalars().all()
    return [_device_out(d) for d in devices]


async def _get_owned_device(db: AsyncSession, device_id: uuid.UUID, user: CurrentUser) -> Device:
    result = await db.execute(select(Device).where(Device.id == device_id, Device.user_id == user.id))
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="device introuvable")
    return device


@router.get("/{device_id}", response_model=DeviceOut)
async def get_device(
    device_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeviceOut:
    """Detail d'un device (polling post-liaison cloud)."""
    device = await _get_owned_device(db, device_id, user)
    return _device_out(device)


@router.patch("/{device_id}", response_model=DeviceOut)
async def update_device(
    device_id: uuid.UUID,
    payload: DevicePatch,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeviceOut:
    """Met a jour le nom/marque/modele/profil d'un device ; recalcule delivery_tier
    si la marque ou le modele changent (jamais choisi a la main)."""
    device = await _get_owned_device(db, device_id, user)
    # exclude_unset seul : un champ explicitement envoye a `null` (ex. pour
    # effacer le nom ou le modele) doit etre applique. `exclude_defaults`
    # casserait ce cas car `None` est aussi la valeur par defaut du champ.
    updates = payload.model_dump(exclude_unset=True)

    brand_or_model_changed = "brand" in updates or "model" in updates
    if "conversion_profile" in updates:
        updates["conversion_profile"] = conversion_profiles.to_storage(updates["conversion_profile"])
    for field, value in updates.items():
        setattr(device, field, value)

    if brand_or_model_changed:
        device.delivery_tier = _compute_tier(device.brand, device.model)

    await db.commit()
    await db.refresh(device)
    return _device_out(device)


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    device = await _get_owned_device(db, device_id, user)
    await device_service.delete_device(db, device)


@router.get("/{device_id}/methods", response_model=list[MethodAvailability])
async def get_delivery_methods(
    device_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MethodAvailability]:
    """Modes de livraison candidats pour ce device (email/dropbox/drive/
    browser_code), chacun avec sa disponibilite reelle : le frontend s'en
    sert pour proposer uniquement les modes utilisables au lieu de laisser
    choisir un tier technique A/B/C/D a la main."""
    device = await _get_owned_device(db, device_id, user)
    return available_delivery_methods(device, mailer.is_configured())


def _check_provider(provider: str) -> None:
    if provider not in _PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="provider doit etre 'dropbox' ou 'drive'"
        )


def _require_fernet_key() -> None:
    settings = get_settings()
    if not settings.fernet_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="chiffrement au repos non configure (FERNET_KEY manquante)",
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
    _require_fernet_key()
    await _get_owned_device(db, device_id, user)
    settings = get_settings()

    try:
        state = crypto.issue_oauth_state(device_id, provider, ttl_seconds=settings.oauth_state_ttl_seconds)
    except crypto.CryptoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="impossible de signer le state OAuth (FERNET_KEY)",
        ) from exc

    if provider == "dropbox":
        if not settings.dropbox_client_id:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Dropbox non configure (DROPBOX_CLIENT_ID manquant)",
            )
        redirect_uri = settings.dropbox_redirect_uri.format(id=device_id)
        url = cloud_links.dropbox_authorize_url(settings.dropbox_client_id, redirect_uri, state)
    else:
        if not settings.google_client_id:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Google Drive non configure (GOOGLE_CLIENT_ID manquant)",
            )
        redirect_uri = settings.google_redirect_uri.format(id=device_id)
        url = cloud_links.drive_authorize_url(settings.google_client_id, redirect_uri, state)

    return DeviceLinkUrlOut(url=url)


async def _exchange_and_store_link(
    db: AsyncSession,
    device: Device,
    provider: str,
    code: str,
) -> None:
    """Echange le code OAuth et stocke `link_ref` chiffre sur le device."""
    settings = get_settings()
    _require_fernet_key()

    try:
        if provider == "dropbox":
            if not settings.dropbox_client_id or not settings.dropbox_client_secret:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Dropbox non configure (DROPBOX_CLIENT_ID/DROPBOX_CLIENT_SECRET manquants)",
                )
            redirect_uri = settings.dropbox_redirect_uri.format(id=device.id)
            tokens = await cloud_links.exchange_dropbox_code(
                code, settings.dropbox_client_id, settings.dropbox_client_secret, redirect_uri
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
            redirect_uri = settings.google_redirect_uri.format(id=device.id)
            tokens = await cloud_links.exchange_drive_code(
                code, settings.google_client_id, settings.google_client_secret, redirect_uri
            )
            refresh_token = tokens.get("refresh_token")
            if not refresh_token:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY, detail="reponse Google sans refresh_token"
                )
            link_ref = {"provider": "drive", "refresh_token": refresh_token}
        device.link_ref = cloud_links.serialize_link_ref(link_ref)
    except cloud_links.CloudLinkError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    await db.commit()
    await db.refresh(device)


@router.get("/{device_id}/link/callback")
async def link_callback_get(
    device_id: uuid.UUID,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Callback OAuth public (navigateur) : valide `state`, echange `code`,
    redirige vers le dashboard. Sans auth Clerk — le `state` signe + store
    serveur prouve l'intention de liaison."""
    if not code or not state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="code et state sont requis",
        )

    try:
        provider = crypto.consume_oauth_state(state, device_id)
    except crypto.CryptoError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="state invalide") from exc

    _check_provider(provider)

    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="device introuvable")

    try:
        await _exchange_and_store_link(db, device, provider, code)
    except HTTPException as exc:
        logger.warning("echec callback cloud link device=%s: %s", device_id, exc.detail)
        return _dashboard_redirect("error")

    return _dashboard_redirect("ok")


@router.post("/{device_id}/link/callback", response_model=DeviceOut)
async def link_callback(
    device_id: uuid.UUID,
    payload: DeviceLinkCallback,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeviceOut:
    """Echange le code OAuth contre un token et le stocke chiffre (API auth).

    Conserve pour clients API ; le parcours UI passe par le GET public + state.
    """
    _check_provider(payload.provider)
    device = await _get_owned_device(db, device_id, user)
    await _exchange_and_store_link(db, device, payload.provider, payload.code)
    return _device_out(device)
