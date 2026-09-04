"""Calcule les modes de livraison candidats/disponibles pour un `Device`.

Le routage reel d'une livraison (`services.delivery.deliver`) se fait par
`device.delivery_tier`, jamais par le `method` choisi cote client. Ce module
sert deux usages :

- exposer au frontend (`GET /api/v1/devices/{id}/methods`) quels
  `DeliveryMethod` sont pertinents pour ce device et pourquoi certains sont
  indisponibles (SMTP non configure, cloud non lie...), pour remplacer la
  dropdown technique A/B/C/D qui laissait choisir un mode incoherent ;
- valider, cote API (`POST /api/v1/deliveries`), que le `method` demande
  correspond bien a un mode reellement disponible pour ce device.
"""

from __future__ import annotations

from pydantic import BaseModel

from ferry_agent.models import DeliveryMethod, DeliveryTier, Device
from ferry_agent.services import cloud_links


class MethodAvailability(BaseModel):
    method: DeliveryMethod
    available: bool
    reason_code: str | None = None


def available_delivery_methods(device: Device, smtp_configured: bool) -> list[MethodAvailability]:
    """Modes candidats pour le tier du device, chacun annote de sa disponibilite
    reelle et, si indisponible, d'un code de raison stable (traduit cote
    frontend) plutot que d'un message en dur."""
    if device.delivery_tier == DeliveryTier.A:
        return [
            MethodAvailability(
                method=DeliveryMethod.email,
                available=smtp_configured,
                reason_code=None if smtp_configured else "smtp_not_configured",
            )
        ]

    if device.delivery_tier == DeliveryTier.B:
        link_ref = None
        if device.link_ref:
            try:
                link_ref = cloud_links.parse_link_ref(device.link_ref)
            except cloud_links.CloudLinkError:
                link_ref = None
        if link_ref is not None:
            method = DeliveryMethod.dropbox if link_ref["provider"] == "dropbox" else DeliveryMethod.drive
            return [MethodAvailability(method=method, available=True)]
        return [
            MethodAvailability(method=DeliveryMethod.dropbox, available=False, reason_code="cloud_not_linked"),
            MethodAvailability(method=DeliveryMethod.drive, available=False, reason_code="cloud_not_linked"),
        ]

    if device.delivery_tier == DeliveryTier.C:
        return [MethodAvailability(method=DeliveryMethod.browser_code, available=True)]

    # Tier D (marque "other") : aucun mode de livraison implemente.
    return []


def is_method_allowed(device: Device, method: DeliveryMethod, smtp_configured: bool) -> bool:
    """True si `method` correspond a un mode reellement disponible pour ce device."""
    return any(
        candidate.method == method and candidate.available
        for candidate in available_delivery_methods(device, smtp_configured)
    )
