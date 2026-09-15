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
 12. list_opds_tokens     — jetons OPDS (sans secret)
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
        "list_devices + list_device_methods puis deliver(confirm=True, method=…) "
        "pour envoyer ; get_delivery_status pour suivre ; "
        "list_gateways / get_gateway_job pour le catalogue local ; "
        "list_sources / get_profile / list_opds_tokens pour les réglages."
    ),
)

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
            reason = m.get("reason_code") or "indisponible"
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
        format:    Format cible optionnel (epub, mobi, azw3, pdf).

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
    return _kv(parts)


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
# 12. list_opds_tokens
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
# Point d'entrée
# ---------------------------------------------------------------------------

def main() -> None:
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
