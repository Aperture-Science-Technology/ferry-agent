"""Serveur MCP Ferry Agent — wrapper mince du core REST.

Outils (identité Clerk utilisateur obligatoire, pas de compte-service) :
  1. search_library       — recherche (sources légales + gateways)
  2. add_to_library       — ajout à la bibliothèque
  3. list_library         — bibliothèque de l'utilisateur courant
  4. list_devices         — liseuses + lien cloud
  5. list_device_methods  — modes de livraison réellement disponibles
  6. deliver              — livraison (garde-fou confirm + method)
  7. get_delivery_status  — statut d'un job de livraison
  8. list_gateways        — gateways appairées
  9. get_gateway_job      — suivi d'un job gateway (fetch asynchrone)
 10. list_sources         — sources activées / désactivées
 11. get_profile          — profil (format défaut, kindle_email)
 12. get_mail_settings    — réglages d'envoi (adresse à approuver chez Amazon)
 13. list_opds_tokens     — jetons OPDS (sans secret)
 14. update_profile       — mise à jour profil (kindle_email, format)
 15. get_device           — détail d'une liseuse
 16. add_device           — enregistrement d'une liseuse
 17. update_device        — modification d'une liseuse
 18. remove_device        — suppression (garde-fou confirm)
 19. link_device_cloud    — URL OAuth Dropbox/Drive (tier B)
 20. set_source_enabled   — activer / désactiver une source
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx
from fastmcp import FastMCP
from fastmcp.server.dependencies import get_access_token

from ferry_mcp.config import get_settings

logger = logging.getLogger(__name__)


def build_mcp_auth_provider():
    settings = get_settings()
    if not settings.mcp_auth_enabled:
        return None

    missing = [
        name
        for name, value in (
            ("CLERK_DOMAIN", settings.clerk_domain),
            ("CLERK_OAUTH_CLIENT_ID", settings.clerk_oauth_client_id),
            ("CLERK_OAUTH_CLIENT_SECRET", settings.clerk_oauth_client_secret),
            ("MCP_BASE_URL", settings.mcp_base_url),
        )
        if not (value or "").strip()
    ]
    if missing:
        raise RuntimeError(
            "MCP_AUTH_ENABLED is true but OAuth config is incomplete: "
            + ", ".join(missing)
        )

    from fastmcp.server.auth.providers.clerk import ClerkProvider

    return ClerkProvider(
        domain=settings.clerk_domain,
        client_id=settings.clerk_oauth_client_id,
        client_secret=settings.clerk_oauth_client_secret,
        base_url=settings.mcp_base_url,
    )


mcp = FastMCP(
    "ferry-agent-mcp",
    auth=build_mcp_auth_provider(),
    instructions=(
        "Ferry Agent MCP : bibliothèque, liseuses, gateways et livraisons "
        "pour l'utilisateur authentifié. "
        "search_library / add_to_library / list_library pour les livres ; "
        "list_devices / get_device / add_device / update_device / remove_device "
        "+ list_device_methods puis deliver(confirm=True, method=…) pour envoyer ; "
        "link_device_cloud pour le tier B (Kobo) ; get_delivery_status pour suivre ; "
        "list_gateways / get_gateway_job pour le catalogue local ; "
        "list_sources / set_source_enabled / get_profile / update_profile / "
        "get_mail_settings / list_opds_tokens pour les réglages."
    ),
)

# Identifiants alignés sur le cœur (schemas / DeviceBrand / ConversionPreset).
_DEVICE_BRANDS = frozenset({"kindle", "kobo", "tolino", "pocketbook", "other"})
_CONVERSION_PRESETS = frozenset({"reader_6in", "reader_7in_plus", "tablet"})
_DEFAULT_FORMATS = frozenset({"epub", "mobi", "azw3", "pdf"})
_CLOUD_PROVIDERS = frozenset({"dropbox", "drive"})

# Codes de raison d'indisponibilité → phrase française actionnable.
# Le code brut est conservé entre parenthèses pour le diagnostic.
_REASON_CODE_FR: dict[str, str] = {
    "kindle_email_missing": (
        "aucune adresse Send-to-Kindle connue (ni sur l'appareil, ni dans le "
        "profil) ; renseignez-la dans les réglages ou sur l'appareil"
    ),
    "smtp_not_configured": (
        "l'envoi par email n'est pas activé sur la plateforme"
    ),
    "cloud_not_linked": (
        "le compte cloud n'est pas lié ; liez Dropbox ou Drive dans les réglages"
    ),
}

_USER_AGENT = "ferry-agent-mcp"

# Messages d'erreur stables et actionnables (contrat MCP).
_ERR_AUTH = (
    "Authentification requise : reconnectez-vous (OAuth Clerk) puis réessayez."
)
_ERR_FORBIDDEN = "Accès refusé pour cet utilisateur."
_ERR_NOT_FOUND = "Ressource introuvable pour cet utilisateur."
_ERR_BAD_REQUEST = "Requête invalide"
_ERR_QUOTA = "Quota de stockage insuffisant."
_ERR_CORE = "Erreur du service Ferry"


def _resolve_user_token() -> str:
    """Retourne le token Clerk de l'utilisateur authentifié courant.

    FastMCP expose l'identité OAuth validée via `get_access_token()`
    (fastmcp.server.dependencies) : elle lit le ContextVar posé par le
    middleware d'auth (ou `request.scope["user"]` en HTTP) sans qu'il soit
    besoin d'injecter `ctx: Context` dans les tools. `AccessToken.token`
    porte le jeton amont Clerk obtenu par `ClerkProvider` (un `OAuthProxy`)
    lors de l'échange OAuth — c'est ce jeton qu'on relaie au core en
    `Authorization: Bearer`.

    Aucun fallback compte-service : si aucune identité Clerk n'est résolue,
    lève une RuntimeError explicite.
    """
    access_token = get_access_token()
    if access_token is None or not access_token.token:
        raise RuntimeError(
            "Aucune identité utilisateur Clerk authentifiée n'a été trouvée pour "
            "cet appel MCP. Reconnectez-vous."
        )
    return access_token.token


def _client(token: str | None = None) -> httpx.AsyncClient:
    settings = get_settings()
    if not token:
        raise RuntimeError(
            "Token utilisateur Clerk requis : impossible d'appeler le core "
            "sans identité authentifiée."
        )
    headers = {
        "User-Agent": _USER_AGENT,
        "Authorization": f"Bearer {token}",
    }
    return httpx.AsyncClient(base_url=settings.ferry_core_url, headers=headers, timeout=30.0)


def _core_detail(resp: httpx.Response) -> str:
    """Extrait un détail actionnable depuis une réponse d'erreur FastAPI."""
    text = (resp.text or "").strip()
    try:
        payload = resp.json()
    except Exception:
        return text[:400] if text else ""
    if isinstance(payload, dict):
        detail = payload.get("detail")
        if isinstance(detail, str) and detail.strip():
            return detail.strip()
        if isinstance(detail, list):
            # Validation pydantic : garder un résumé stable.
            parts: list[str] = []
            for item in detail[:5]:
                if isinstance(item, dict):
                    msg = item.get("msg") or item.get("type")
                    loc = item.get("loc")
                    if msg and loc:
                        parts.append(f"{'.'.join(str(x) for x in loc)}: {msg}")
                    elif msg:
                        parts.append(str(msg))
            if parts:
                return "; ".join(parts)
        return text[:400] if text else ""
    return text[:400] if text else ""


def _raise_for(resp: httpx.Response) -> None:
    """Lève une RuntimeError stable et actionnable sur erreur HTTP core."""
    if not resp.is_error:
        return
    detail = _core_detail(resp)
    code = resp.status_code
    if code in (401, 403):
        raise RuntimeError(_ERR_AUTH if code == 401 else _ERR_FORBIDDEN)
    if code == 404:
        raise RuntimeError(f"{_ERR_NOT_FOUND}" + (f" ({detail})" if detail else ""))
    if code == 400:
        raise RuntimeError(f"{_ERR_BAD_REQUEST}: {detail}" if detail else f"{_ERR_BAD_REQUEST}.")
    if code == 422:
        raise RuntimeError(f"{_ERR_BAD_REQUEST}: {detail}" if detail else f"{_ERR_BAD_REQUEST}.")
    if code == 507:
        raise RuntimeError(f"{_ERR_QUOTA}" + (f" ({detail})" if detail else ""))
    raise RuntimeError(
        f"{_ERR_CORE} HTTP {code}" + (f": {detail}" if detail else "")
    )


def _kv(parts: list[str]) -> str:
    return " | ".join(p for p in parts if p)


def _format_reason_code(code: str) -> str:
    """Traduit un reason_code en phrase FR actionnable, code brut conservé."""
    phrase = _REASON_CODE_FR.get(code)
    if phrase:
        return f"{phrase} ({code})"
    return code


def _device_label(device: dict[str, Any]) -> str:
    name = (device.get("name") or "").strip()
    brand_model = f"{device.get('brand', '?')} {device.get('model') or ''}".strip()
    if name and brand_model:
        return f"{name} ({brand_model})"
    return name or brand_model or str(device.get("id", "?"))


def _cloud_label(device: dict[str, Any]) -> str:
    if not device.get("cloud_linked"):
        return "cloud: non lié"
    provider = device.get("cloud_provider")
    if provider == "dropbox":
        return "cloud: Dropbox"
    if provider == "drive":
        return "cloud: Google Drive"
    return "cloud: lié"


def _format_device_line(device: dict[str, Any]) -> str:
    """Une ligne lisible (même style que list_devices)."""
    return (
        f"**{_device_label(device)}** — "
        f"tier: {device.get('delivery_tier')} | {_cloud_label(device)} | "
        f"id: {device.get('id')}"
    )


def _validate_choice(value: str, allowed: frozenset[str], label: str) -> None:
    if value not in allowed:
        choices = ", ".join(sorted(allowed))
        raise RuntimeError(
            f"{_ERR_BAD_REQUEST}: {label} '{value}' invalide. "
            f"Valeurs acceptées: {choices}."
        )


async def _fetch_available_methods(client: httpx.AsyncClient, device_id: str) -> list[dict[str, Any]]:
    resp = await client.get(f"/api/v1/devices/{device_id}/methods")
    _raise_for(resp)
    methods = resp.json()
    if not isinstance(methods, list):
        return []
    return [m for m in methods if isinstance(m, dict) and m.get("available")]


# ---------------------------------------------------------------------------
# 1. search_library
# ---------------------------------------------------------------------------

@mcp.tool
async def search_library(query: str, scope: list[str] | None = None) -> str:
    """Recherche des ebooks dans les sources légales et les gateways appairées.

    Args:
        query: Titre, auteur ou mots-clés à rechercher.
        scope: Optionnel. Ex. ["legal"], ["gateways"], ou ["gateway:<uuid>"].
               Absent = legal + gateways (comportement API par défaut).

    Returns:
        Liste lisible des résultats (titre, auteur, source, format, owned, id).
    """
    body: dict[str, Any] = {"query": query}
    if scope is not None:
        body["scope"] = scope

    async with _client(_resolve_user_token()) as client:
        resp = await client.post("/api/v1/books/search", json=body)
    _raise_for(resp)
    results = resp.json()
    if not results:
        return "Aucun résultat trouvé."
    lines = []
    for r in results:
        owned = "oui" if r.get("owned") else "non"
        size_ko = int(r.get("size_bytes") or 0) // 1024
        lines.append(
            f"**{r.get('title', '?')}** — {r.get('author') or '?'}\n"
            f"  source: {r.get('source')} | format: {r.get('format', '?')} | "
            f"taille: {size_ko} Ko | déjà en bibliothèque: {owned} | "
            f"id: {r.get('result_id')}"
        )
    return "\n\n".join(lines)


# ---------------------------------------------------------------------------
# 2. add_to_library
# ---------------------------------------------------------------------------

@mcp.tool
async def add_to_library(source: str, result_id: str) -> str:
    """Ajoute un livre à la bibliothèque depuis une source légale ou un gateway.

    Args:
        source: Identifiant de la source (ex: "gutenberg", "gateway:<uuid>").
        result_id: Identifiant du résultat retourné par search_library.

    Returns:
        library_item_id créé, ou gateway_job_id si l'ajout est asynchrone (gateway).
    """
    async with _client(_resolve_user_token()) as client:
        resp = await client.post(
            "/api/v1/books",
            json={"source": source, "result_id": result_id},
        )
    _raise_for(resp)
    data = resp.json()
    if isinstance(data, dict) and "id" in data:
        return (
            f"Livre ajouté.\n"
            f"library_item_id: {data['id']} | "
            f"title: {data.get('title', '?')} | author: {data.get('author', '?')}"
        )
    if isinstance(data, dict) and "gateway_job_id" in data:
        return (
            f"Récupération via gateway en cours (asynchrone).\n"
            f"gateway_job_id: {data['gateway_job_id']} — status: {data.get('status')}\n"
            f"Suivre avec get_gateway_job(job_id='{data['gateway_job_id']}')."
        )
    return str(data)


# ---------------------------------------------------------------------------
# 3. list_library
# ---------------------------------------------------------------------------

@mcp.tool
async def list_library(page: int = 1, limit: int = 50) -> str:
    """Liste la bibliothèque de l'utilisateur courant (paginée).

    Args:
        page: Numéro de page (commence à 1).
        limit: Nombre d'éléments par page (1–200).

    Returns:
        Titre, auteur, format et library_item_id de chaque livre.
    """
    async with _client(_resolve_user_token()) as client:
        resp = await client.get(
            "/api/v1/books",
            params={"page": page, "limit": limit},
        )
    _raise_for(resp)
    data = resp.json()
    items = data.get("items") if isinstance(data, dict) else None
    if not items:
        return "Bibliothèque vide."
    total = data.get("total", len(items))
    lines = [f"Bibliothèque — page {data.get('page', page)}/{max(1, (int(total) + limit - 1) // limit)} (total: {total})"]
    for item in items:
        lines.append(
            f"**{item.get('title', '?')}** — {item.get('author') or '?'}\n"
            f"  format: {item.get('original_format', '?')} | "
            f"library_item_id: {item.get('id')}"
        )
    return "\n\n".join(lines)


# ---------------------------------------------------------------------------
# 4. list_devices
# ---------------------------------------------------------------------------

@mcp.tool
async def list_devices() -> str:
    """Liste les liseuses enregistrées avec leur tier et leur état de liaison cloud.

    Returns:
        Description lisible de chaque liseuse (nom, marque, modèle, tier, cloud, id).
    """
    async with _client(_resolve_user_token()) as client:
        resp = await client.get("/api/v1/devices")
    _raise_for(resp)
    devices = resp.json()
    if not devices:
        return "Aucune liseuse enregistrée."
    lines = []
    for d in devices:
        lines.append(
            f"**{_device_label(d)}** — "
            f"tier: {d.get('delivery_tier')} | {_cloud_label(d)} | id: {d.get('id')}"
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 5. list_device_methods
# ---------------------------------------------------------------------------

@mcp.tool
async def list_device_methods(device_id: str) -> str:
    """Liste les modes de livraison réellement disponibles pour une liseuse.

    Args:
        device_id: UUID de la liseuse.

    Returns:
        Modes disponibles (email, dropbox, drive, browser_code…) et raisons
        d'indisponibilité le cas échéant. À utiliser avant deliver.
    """
    async with _client(_resolve_user_token()) as client:
        resp = await client.get(f"/api/v1/devices/{device_id}/methods")
    _raise_for(resp)
    methods = resp.json()
    if not methods:
        return "Aucun mode de livraison pour cette liseuse."
    lines = []
    for m in methods:
        if m.get("available"):
            lines.append(f"✓ {m.get('method')} — disponible")
        else:
            raw = m.get("reason_code")
            reason = _format_reason_code(raw) if raw else "indisponible"
            lines.append(f"✗ {m.get('method')} — {reason}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 6. deliver
# ---------------------------------------------------------------------------

@mcp.tool
async def deliver(
    item_id: str,
    device_id: str,
    confirm: bool = False,
    method: str | None = None,
    format: str | None = None,
) -> str:
    """Envoie un livre vers une liseuse.

    Un garde-fou oblige à passer confirm=True pour déclencher réellement l'envoi.
    Le mode (`method`) doit être un mode disponible pour le device
    (voir list_device_methods). Si omis avec confirm=True, le premier mode
    disponible est choisi.

    Args:
        item_id:   UUID du livre dans la bibliothèque (library_item_id).
        device_id: UUID de la liseuse cible.
        confirm:   Doit être True pour confirmer l'envoi. Si False, l'outil refuse.
        method:    Mode de livraison (email, dropbox, drive, browser_code…).
        format:    Format cible optionnel (epub, mobi, azw3, pdf). Pour un
                   appareil Kindle, seuls epub et pdf ont un sens ; mobi/azw3
                   sont convertis en EPUB côté serveur car Amazon les refuse
                   depuis fin 2023.

    Returns:
        Confirmation de l'envoi avec le statut du job, ou message de refus.
    """
    token = _resolve_user_token()

    async with _client(token) as client:
        # Prévisualisation / résolution du mode avant tout POST /deliveries.
        device_label = device_id
        try:
            resp = await client.get("/api/v1/devices")
            if not resp.is_error:
                for d in resp.json():
                    if str(d.get("id")) == str(device_id):
                        device_label = _device_label(d)
                        break
        except Exception:
            pass

        available: list[dict[str, Any]] = []
        try:
            available = await _fetch_available_methods(client, device_id)
        except RuntimeError as exc:
            # Auth / isolation : toujours remonter. Autres erreurs : message
            # actionnable en mode prévisualisation (confirm=False).
            msg = str(exc)
            if confirm or _ERR_AUTH in msg or _ERR_FORBIDDEN in msg:
                raise
            return (
                f"⚠️ Livraison non confirmée.\n"
                f"Impossible de lister les modes pour {device_label}: {exc}\n"
                f"Appelle list_device_methods(device_id='{device_id}') puis "
                f"deliver(..., confirm=True, method=...)."
            )

        available_names = [str(m.get("method")) for m in available if m.get("method")]

        if not confirm:
            methods_hint = (
                ", ".join(available_names) if available_names else "(aucun mode disponible)"
            )
            chosen = method or (available_names[0] if available_names else "<method>")
            fmt_hint = f", format='{format}'" if format else ""
            return (
                f"⚠️ Livraison non confirmée.\n"
                f"Modes disponibles: {methods_hint}\n"
                f"Appelle deliver(item_id='{item_id}', device_id='{device_id}', "
                f"confirm=True, method='{chosen}'{fmt_hint}) "
                f"pour envoyer vers {device_label}."
            )

        resolved_method = method
        if not resolved_method:
            if not available_names:
                raise RuntimeError(
                    f"{_ERR_BAD_REQUEST}: aucun mode de livraison disponible pour "
                    f"{device_label}. Vérifiez le lien cloud / SMTP "
                    f"(list_device_methods)."
                )
            resolved_method = available_names[0]
        elif available_names and resolved_method not in available_names:
            raise RuntimeError(
                f"{_ERR_BAD_REQUEST}: method '{resolved_method}' indisponible. "
                f"Modes disponibles: {', '.join(available_names)}."
            )

        payload: dict[str, Any] = {
            "library_item_id": item_id,
            "device_id": device_id,
            "method": resolved_method,
        }
        if format:
            payload["format"] = format

        resp = await client.post("/api/v1/deliveries", json=payload)
    _raise_for(resp)
    data = resp.json()
    parts = [
        f"job_id: {data.get('id')}",
        f"status: {data.get('status')}",
        f"method: {data.get('method', resolved_method)}",
    ]
    if data.get("target_format") or format:
        parts.append(f"format: {data.get('target_format') or format}")
    if data.get("item_title"):
        parts.append(f"livre: {data['item_title']}")
    if data.get("device_label"):
        parts.append(f"liseuse: {data['device_label']}")
    msg = "Job de livraison créé.\n" + _kv(parts)
    if data.get("download_url"):
        msg += f"\nURL de téléchargement (tier C): {data['download_url']}"
    return msg


# ---------------------------------------------------------------------------
# 7. get_delivery_status
# ---------------------------------------------------------------------------

@mcp.tool
async def get_delivery_status(job_id: str) -> str:
    """Retourne le statut d'un job de livraison.

    Args:
        job_id: UUID du job retourné par deliver.

    Returns:
        Statut, méthode, livre, liseuse, horodatage et éventuelle erreur.
    """
    async with _client(_resolve_user_token()) as client:
        resp = await client.get(f"/api/v1/deliveries/{job_id}")
    _raise_for(resp)
    data = resp.json()
    parts = [
        f"status: {data.get('status')}",
        f"method: {data.get('method')}",
    ]
    if data.get("item_title"):
        parts.append(f"livre: {data['item_title']}")
    if data.get("device_label"):
        parts.append(f"liseuse: {data['device_label']}")
    if data.get("target_format"):
        parts.append(f"format: {data['target_format']}")
    if data.get("delivered_at"):
        parts.append(f"livré le: {data['delivered_at']}")
    if data.get("error"):
        parts.append(f"erreur: {data['error']}")
    if data.get("download_url"):
        parts.append(f"URL: {data['download_url']}")
    msg = _kv(parts)
    if data.get("method") == "email" and data.get("status") == "sent":
        msg += (
            "\nInterprétation: le relais a accepté le message — cela ne prouve "
            "pas la remise sur la Kindle. Amazon ne confirme jamais la "
            "livraison ; si l'adresse d'envoi n'est pas approuvée, le document "
            "est abandonné sans rebond. Appelez get_mail_settings() pour "
            "obtenir l'adresse à approuver chez Amazon."
        )
    return msg


# ---------------------------------------------------------------------------
# 8. list_gateways
# ---------------------------------------------------------------------------

@mcp.tool
async def list_gateways() -> str:
    """Liste les gateways (catalogue local) de l'utilisateur courant.

    Returns:
        Nom, statut d'appairage, dernière activité et gateway_id.
    """
    async with _client(_resolve_user_token()) as client:
        resp = await client.get("/api/v1/gateways")
    _raise_for(resp)
    gateways = resp.json()
    if not gateways:
        return "Aucune gateway enregistrée."
    lines = []
    for g in gateways:
        gid = g.get("gateway_id") or g.get("id")
        lines.append(
            f"**{g.get('name', 'Gateway')}** — status: {g.get('status')} | "
            f"last_seen: {g.get('last_seen_at') or 'jamais'} | "
            f"gateway_id: {gid} (source search: gateway:{gid})"
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 9. get_gateway_job
# ---------------------------------------------------------------------------

@mcp.tool
async def get_gateway_job(job_id: str) -> str:
    """Suit un job gateway (ex. fetch après add_to_library asynchrone).

    Args:
        job_id: UUID du job (gateway_job_id).

    Returns:
        Type, statut, library_item_id si terminé, erreur éventuelle.
    """
    async with _client(_resolve_user_token()) as client:
        resp = await client.get(f"/api/v1/gateways/jobs/{job_id}")
    _raise_for(resp)
    data = resp.json()
    parts = [
        f"job_id: {data.get('job_id') or job_id}",
        f"type: {data.get('type')}",
        f"status: {data.get('status')}",
    ]
    if data.get("library_item_id"):
        parts.append(f"library_item_id: {data['library_item_id']}")
    if data.get("error"):
        parts.append(f"erreur: {data['error']}")
    if data.get("attempts") is not None:
        parts.append(f"attempts: {data['attempts']}")
    return _kv(parts)


# ---------------------------------------------------------------------------
# 10. list_sources
# ---------------------------------------------------------------------------

@mcp.tool
async def list_sources() -> str:
    """Liste les sources de recherche de l'utilisateur (activées ou non).

    Returns:
        Type de source, état enabled, et source_id.
    """
    async with _client(_resolve_user_token()) as client:
        resp = await client.get("/api/v1/sources")
    _raise_for(resp)
    sources = resp.json()
    if not sources:
        return "Aucune source configurée."
    lines = []
    for s in sources:
        state = "activée" if s.get("enabled") else "désactivée"
        lines.append(f"**{s.get('type')}** — {state} | source_id: {s.get('id')}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 11. get_profile
# ---------------------------------------------------------------------------

@mcp.tool
async def get_profile() -> str:
    """Retourne le profil de l'utilisateur courant (réglages de livraison).

    Returns:
        Email, kindle_email, default_format (sans secrets).
    """
    async with _client(_resolve_user_token()) as client:
        resp = await client.get("/api/v1/users/me")
    _raise_for(resp)
    data = resp.json()
    return _kv(
        [
            f"email: {data.get('email')}",
            f"kindle_email: {data.get('kindle_email') or '(non défini)'}",
            f"default_format: {data.get('default_format')}",
            f"user_id: {data.get('id')}",
        ]
    )


# ---------------------------------------------------------------------------
# 12. get_mail_settings
# ---------------------------------------------------------------------------

@mcp.tool
async def get_mail_settings() -> str:
    """Retourne les réglages d'envoi email (Send-to-Kindle) visibles.

    Utile pour expliquer pourquoi un livre n'est jamais arrivé : l'adresse
    d'envoi doit être approuvée chez Amazon, sinon le document est abandonné
    en silence (aucun rebond).

    Returns:
        État de configuration, adresse à approuver, domaines acceptés, quotas
        (sans secrets SMTP).
    """
    async with _client(_resolve_user_token()) as client:
        resp = await client.get("/api/v1/mail/settings")
    _raise_for(resp)
    data = resp.json()
    configured = "oui" if data.get("configured") else "non"
    sender = data.get("sender_address") or "(non définie)"
    domains = data.get("allowed_domains") or []
    domains_txt = ", ".join(str(d) for d in domains) if domains else "(aucun)"
    lines = [
        f"envoi configuré: {configured}",
        f"adresse d'envoi à approuver chez Amazon: {sender}",
        (
            "action: ajoutez cette adresse dans « Approved Personal Document "
            "Email List » sur https://www.amazon.com/mycd "
            "(Préférences → Personal Document Settings)"
        ),
        (
            "avertissement: Amazon ne renvoie aucun rebond ; sans approbation "
            "le document est abandonné en silence"
        ),
        f"domaines de destinataires acceptés: {domains_txt}",
        f"quota horaire: {data.get('hourly_quota')}",
        f"quota quotidien: {data.get('daily_quota')}",
    ]
    reply_to = data.get("reply_to")
    if reply_to:
        lines.append(f"reply-to: {reply_to}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 13. list_opds_tokens
# ---------------------------------------------------------------------------

@mcp.tool
async def list_opds_tokens() -> str:
    """Liste les jetons OPDS de l'utilisateur (sans révéler le secret).

    Returns:
        Label, dates et token_id. La valeur secrète n'est jamais renvoyée.
    """
    async with _client(_resolve_user_token()) as client:
        resp = await client.get("/api/v1/opds/tokens")
    _raise_for(resp)
    tokens = resp.json()
    if not tokens:
        return "Aucun jeton OPDS."
    lines = []
    for t in tokens:
        lines.append(
            f"**{t.get('label', 'OPDS')}** — créé: {t.get('created_at')} | "
            f"dernier usage: {t.get('last_used_at') or 'jamais'} | "
            f"token_id: {t.get('id')}"
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 14. update_profile
# ---------------------------------------------------------------------------

@mcp.tool
async def update_profile(
    kindle_email: str | None = None,
    default_format: str | None = None,
    clear_kindle_email: bool = False,
) -> str:
    """Met à jour le profil de livraison (PATCH partiel).

    `kindle_email` est l'adresse Send-to-Kindle de repli quand la liseuse n'a
    pas la sienne ; l'expéditeur Ferry doit être approuvé chez Amazon
    (voir get_mail_settings), sinon le document est abandonné sans rebond.

    Un champ omis reste inchangé. `clear_kindle_email=True` efface
    l'adresse (envoie null au cœur).

    Args:
        kindle_email: Nouvelle adresse Send-to-Kindle de repli (ou None = inchangé).
        default_format: Format défaut (`epub` | `mobi` | `azw3` | `pdf`).
        clear_kindle_email: Si True, efface kindle_email (prioritaire sur kindle_email).

    Returns:
        Profil relu (email, kindle_email, default_format).
    """
    body: dict[str, Any] = {}
    if clear_kindle_email:
        body["kindle_email"] = None
    elif kindle_email is not None:
        body["kindle_email"] = kindle_email
    if default_format is not None:
        _validate_choice(default_format, _DEFAULT_FORMATS, "default_format")
        body["default_format"] = default_format
    if not body:
        raise RuntimeError(
            f"{_ERR_BAD_REQUEST}: aucun champ à mettre à jour "
            "(passez kindle_email, default_format ou clear_kindle_email=True)."
        )

    async with _client(_resolve_user_token()) as client:
        resp = await client.patch("/api/v1/users/me", json=body)
    _raise_for(resp)
    data = resp.json()
    return _kv(
        [
            f"email: {data.get('email')}",
            f"kindle_email: {data.get('kindle_email') or '(non défini)'}",
            f"default_format: {data.get('default_format')}",
            f"user_id: {data.get('id')}",
        ]
    )


# ---------------------------------------------------------------------------
# 15. get_device
# ---------------------------------------------------------------------------

@mcp.tool
async def get_device(device_id: str) -> str:
    """Retourne le détail d'une liseuse (mêmes champs que list_devices).

    Args:
        device_id: UUID de la liseuse.

    Returns:
        Nom, marque, modèle, tier, état cloud et id.
    """
    async with _client(_resolve_user_token()) as client:
        resp = await client.get(f"/api/v1/devices/{device_id}")
    _raise_for(resp)
    return _format_device_line(resp.json())


# ---------------------------------------------------------------------------
# 16. add_device
# ---------------------------------------------------------------------------

@mcp.tool
async def add_device(
    brand: str,
    name: str | None = None,
    model: str | None = None,
    email_address: str | None = None,
    conversion_profile: str | None = None,
) -> str:
    """Enregistre une nouvelle liseuse.

    Le `delivery_tier` est calculé par le cœur (kindle→A, kobo haut de gamme→B,
    kobo/tolino→C, other→D) : ne jamais l'envoyer.

    Pour une Kindle, `email_address` est l'adresse `@kindle.com` de l'appareil ;
    l'omettre fait retomber sur le `kindle_email` du profil.

    Args:
        brand: Marque (`kindle` | `kobo` | `tolino` | `pocketbook` | `other`).
        name: Nom libre (ex. « Salon »).
        model: Modèle (ex. « Paperwhite », « Forma ») — influence le tier Kobo.
        email_address: Adresse Send-to-Kindle de cet appareil (Kindle).
        conversion_profile: Preset (`reader_6in` | `reader_7in_plus` | `tablet`).

    Returns:
        id, label, tier et état cloud de la liseuse créée.
    """
    _validate_choice(brand, _DEVICE_BRANDS, "brand")
    body: dict[str, Any] = {"brand": brand}
    if name is not None:
        body["name"] = name
    if model is not None:
        body["model"] = model
    if email_address is not None:
        body["email_address"] = email_address
    if conversion_profile is not None:
        _validate_choice(conversion_profile, _CONVERSION_PRESETS, "conversion_profile")
        body["conversion_profile"] = conversion_profile

    async with _client(_resolve_user_token()) as client:
        resp = await client.post("/api/v1/devices", json=body)
    _raise_for(resp)
    return "Liseuse ajoutée.\n" + _format_device_line(resp.json())


# ---------------------------------------------------------------------------
# 17. update_device
# ---------------------------------------------------------------------------

@mcp.tool
async def update_device(
    device_id: str,
    name: str | None = None,
    brand: str | None = None,
    model: str | None = None,
    email_address: str | None = None,
    conversion_profile: str | None = None,
) -> str:
    """Modifie une liseuse (PATCH partiel : seuls les champs fournis sont envoyés).

    Args:
        device_id: UUID de la liseuse.
        name: Nouveau nom (omis = inchangé).
        brand: Nouvelle marque (`kindle` | `kobo` | `tolino` | `pocketbook` | `other`).
        model: Nouveau modèle.
        email_address: Nouvelle adresse Send-to-Kindle de l'appareil.
        conversion_profile: Preset (`reader_6in` | `reader_7in_plus` | `tablet`).

    Returns:
        Liseuse mise à jour (id, label, tier, cloud).
    """
    body: dict[str, Any] = {}
    if name is not None:
        body["name"] = name
    if brand is not None:
        _validate_choice(brand, _DEVICE_BRANDS, "brand")
        body["brand"] = brand
    if model is not None:
        body["model"] = model
    if email_address is not None:
        body["email_address"] = email_address
    if conversion_profile is not None:
        _validate_choice(conversion_profile, _CONVERSION_PRESETS, "conversion_profile")
        body["conversion_profile"] = conversion_profile
    if not body:
        raise RuntimeError(
            f"{_ERR_BAD_REQUEST}: aucun champ à mettre à jour "
            "(passez name, brand, model, email_address ou conversion_profile)."
        )

    async with _client(_resolve_user_token()) as client:
        resp = await client.patch(f"/api/v1/devices/{device_id}", json=body)
    _raise_for(resp)
    return "Liseuse mise à jour.\n" + _format_device_line(resp.json())


# ---------------------------------------------------------------------------
# 18. remove_device
# ---------------------------------------------------------------------------

@mcp.tool
async def remove_device(device_id: str, confirm: bool = False) -> str:
    """Supprime une liseuse (garde-fou confirm=True obligatoire).

    Args:
        device_id: UUID de la liseuse.
        confirm: Doit être True pour confirmer la suppression. Si False, refuse.

    Returns:
        Confirmation de suppression, ou message de prévisualisation.
    """
    token = _resolve_user_token()
    async with _client(token) as client:
        resp = await client.get(f"/api/v1/devices/{device_id}")
        _raise_for(resp)
        device = resp.json()
        label = _device_label(device)

        if not confirm:
            return (
                f"⚠️ Suppression non confirmée.\n"
                f"Liseuse concernée: {_format_device_line(device)}\n"
                f"Appelle remove_device(device_id='{device_id}', confirm=True) "
                f"pour supprimer définitivement {label}."
            )

        resp = await client.delete(f"/api/v1/devices/{device_id}")
    _raise_for(resp)
    return f"Liseuse supprimée: {label} (id: {device_id})."


# ---------------------------------------------------------------------------
# 19. link_device_cloud
# ---------------------------------------------------------------------------

@mcp.tool
async def link_device_cloud(device_id: str, provider: str) -> str:
    """Obtient l'URL OAuth pour lier Dropbox ou Google Drive à une liseuse.

    Prérequis du tier B (Kobo Forma / Sage / Elipsa) : sans liaison cloud,
    la livraison Dropbox/Drive reste indisponible.

    L'URL doit être **ouverte dans un navigateur** par l'utilisateur ; le
    retour se fait sur le dashboard (`?cloud_link=ok`). Vérifier ensuite avec
    list_devices ou get_device que `cloud_linked` est vrai.

    Args:
        device_id: UUID de la liseuse.
        provider: `dropbox` ou `drive`.

    Returns:
        URL d'autorisation à ouvrir dans le navigateur.
    """
    _validate_choice(provider, _CLOUD_PROVIDERS, "provider")
    async with _client(_resolve_user_token()) as client:
        resp = await client.get(
            f"/api/v1/devices/{device_id}/link",
            params={"provider": provider},
        )
    _raise_for(resp)
    data = resp.json()
    url = data.get("url") if isinstance(data, dict) else None
    if not url:
        raise RuntimeError(f"{_ERR_CORE}: URL de liaison cloud absente de la réponse.")
    provider_label = "Dropbox" if provider == "dropbox" else "Google Drive"
    return (
        f"Ouvrez cette URL dans un navigateur pour lier {provider_label} "
        f"(prérequis du tier B pour Kobo Forma/Sage/Elipsa).\n"
        f"Après autorisation, le dashboard affiche ?cloud_link=ok — "
        f"vérifiez avec get_device(device_id='{device_id}') ou list_devices "
        f"que cloud_linked est vrai.\n"
        f"URL: {url}"
    )


# ---------------------------------------------------------------------------
# 20. set_source_enabled
# ---------------------------------------------------------------------------

@mcp.tool
async def set_source_enabled(source_id: str, enabled: bool) -> str:
    """Active ou désactive une source de recherche.

    Args:
        source_id: UUID de la source (voir list_sources).
        enabled: True pour activer, False pour désactiver.

    Returns:
        Type de source et nouvel état.
    """
    async with _client(_resolve_user_token()) as client:
        resp = await client.patch(
            f"/api/v1/sources/{source_id}",
            json={"enabled": enabled},
        )
    _raise_for(resp)
    data = resp.json()
    state = "activée" if data.get("enabled") else "désactivée"
    return f"**{data.get('type')}** — {state} | source_id: {data.get('id')}"


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------

def main() -> None:
    """Démarre le serveur HTTP streamable (protocole MCP 2026-07-28 / legacy).

    FastMCP 4 conserve `run_http_async` : transport streamable-http, mode
    stateless, chemin `/mcp`. La négociation d'ère (discover vs initialize)
    est gérée par le SDK `mcp` 2.x par connexion.
    """
    settings = get_settings()
    asyncio.run(
        mcp.run_http_async(
            transport="streamable-http",
            host="0.0.0.0",
            port=settings.port,
            path="/mcp",
            stateless_http=True,
        )
    )


if __name__ == "__main__":
    main()
