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
 21. list_deliveries      — historique des envois récents
 22. plan_delivery        — dry-run : ce qui va se passer / ce qui bloque
 23. diagnose             — pourquoi un envoi Kindle ne part pas
 24. deliver_to_kindle    — parcours Kindle explicite (email + confirm)
 25. search_library_items — recherche dans la bibliothèque (filtre q)
 26. update_library_item  — métadonnées d'un livre
 27. delete_library_item  — suppression (garde-fou confirm)
 28. list_library_item_deliveries — historique d'envois d'un livre
 29. download_library_item — lien de téléchargement signé (15 min)
 30. create_gateway       — création (secrets affichés une fois)
 31. recreate_gateway     — rotation des clés (affichage unique)
 32. revoke_gateway       — révocation (garde-fou confirm)
 33. delete_gateway       — suppression (garde-fou confirm)
 34. list_gateway_jobs    — jobs récents d'une gateway
 35. create_opds_token    — jeton OPDS (secret une fois + url catalogue)
 36. revoke_opds_token    — révocation OPDS (garde-fou confirm)
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx
from fastmcp import FastMCP
from fastmcp.server.dependencies import get_access_token

from ferry_mcp.assertion import forge_core_assertion
from ferry_mcp.config import get_settings

logger = logging.getLogger(__name__)

_OAUTH_SCOPES = ["openid", "email", "profile"]


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

    # issuer sans slash final (RFC 9207 : comparaison exacte).
    base_url = settings.mcp_base_url.rstrip("/")
    jwt_signing_key = (settings.mcp_jwt_signing_key or "").strip() or None

    return ClerkProvider(
        domain=settings.clerk_domain,
        client_id=settings.clerk_oauth_client_id,
        client_secret=settings.clerk_oauth_client_secret,
        base_url=base_url,
        issuer_url=base_url,
        jwt_signing_key=jwt_signing_key,
        required_scopes=_OAUTH_SCOPES,
        valid_scopes=_OAUTH_SCOPES,
    )


mcp = FastMCP(
    "ferry-agent-mcp",
    auth=build_mcp_auth_provider(),
    instructions=(
        "Ferry Agent MCP : bibliothèque, liseuses, gateways et livraisons "
        "pour l'utilisateur authentifié. "
        "search_library / add_to_library / list_library / search_library_items "
        "/ update_library_item / delete_library_item / download_library_item "
        "/ list_library_item_deliveries pour les livres ; "
        "list_devices / get_device / add_device / update_device / remove_device "
        "+ list_device_methods puis deliver(confirm=True, method=…) pour envoyer ; "
        "deliver_to_kindle pour le parcours Kindle (email) ; "
        "plan_delivery / diagnose / list_deliveries pour anticiper et diagnostiquer ; "
        "link_device_cloud pour le tier B (Kobo) ; get_delivery_status pour suivre ; "
        "list_gateways / create_gateway / recreate_gateway / revoke_gateway / "
        "delete_gateway / list_gateway_jobs / get_gateway_job pour le catalogue local ; "
        "list_sources / set_source_enabled / get_profile / update_profile / "
        "get_mail_settings / list_opds_tokens / create_opds_token / revoke_opds_token "
        "pour les réglages."
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
    """Retourne le Bearer à présenter au cœur pour l'utilisateur courant.

    FastMCP expose l'identité OAuth validée via `get_access_token()`
    (fastmcp.server.dependencies) : ContextVar du middleware d'auth, claims
    enrichis par `ClerkTokenVerifier` (introspection RFC 7662 + userinfo).

    Si `MCP_CORE_ASSERTION_PRIVATE_KEY_B64` est configurée, forge une
    assertion Ed25519 courte (`iss=ferry-agent-mcp`, `aud=ferry-core`) au
    lieu de relayer le jeton Clerk amont. Sinon : repli historique (passthrough
    Clerk) avec avertissement — activation pilotée par l'env.

    Aucun fallback compte-service : si aucune identité Clerk n'est résolue,
    lève une RuntimeError explicite.
    """
    access_token = get_access_token()
    if access_token is None or not access_token.token:
        raise RuntimeError(
            "Aucune identité utilisateur Clerk authentifiée n'a été trouvée pour "
            "cet appel MCP. Reconnectez-vous."
        )

    settings = get_settings()
    private_key_b64 = (settings.mcp_core_assertion_private_key_b64 or "").strip()
    if not private_key_b64:
        logger.warning(
            "MCP_CORE_ASSERTION_PRIVATE_KEY_B64 absente : relais du jeton Clerk "
            "amont (passthrough). Configurez la clé pour activer l'assertion "
            "aud=ferry-core."
        )
        return access_token.token

    claims = getattr(access_token, "claims", None) or {}
    subject = getattr(access_token, "subject", None)
    return forge_core_assertion(
        claims=claims if isinstance(claims, dict) else {},
        subject=subject if isinstance(subject, str) else None,
        private_key_b64=private_key_b64,
    )


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


_AMAZON_SENT_REMINDER = (
    "`sent` = accepté par le relais, pas remis sur la Kindle ; "
    "Amazon ne renvoie aucun rebond. "
    "Appelez get_mail_settings() pour l'adresse à approuver chez Amazon."
)


def _resolve_target_format(
    requested: str | None,
    default_format: str | None,
    original_format: str | None,
) -> tuple[str, str]:
    """Résout le format cible comme le cœur ; retourne (format, explication)."""
    original = (original_format or "epub").lower().lstrip(".")
    default = (default_format or "").lower().lstrip(".") or None
    req = (requested or "").lower().lstrip(".") or None
    if req:
        return req, f"format demandé (`{req}`)"
    if default:
        return default, f"default_format du profil (`{default}`)"
    return original, f"original_format du livre (`{original}`)"


def _kindle_email_for_device(device: dict[str, Any], profile_kindle_email: str | None) -> str | None:
    """Adresse Send-to-Kindle effective (appareil puis repli profil)."""
    device_email = (device.get("email_address") or "").strip() or None
    profile_email = (profile_kindle_email or "").strip() or None
    return device_email or profile_email


def _correction_for_reason(code: str | None, *, device_id: str | None = None) -> str | None:
    """Correction actionnable pour un reason_code (sans inventer d'état)."""
    if code == "kindle_email_missing":
        if device_id:
            return (
                "renseigne l'adresse avec "
                f"update_profile(kindle_email=…) ou "
                f"update_device(device_id='{device_id}', email_address=…)"
            )
        return (
            "renseigne l'adresse avec update_profile(kindle_email=…) "
            "ou update_device(device_id=…, email_address=…)"
        )
    if code == "smtp_not_configured":
        return "côté plateforme, rien à faire côté utilisateur"
    if code == "cloud_not_linked":
        if device_id:
            return (
                f"liez Dropbox ou Drive avec "
                f"link_device_cloud(device_id='{device_id}', provider='dropbox' ou 'drive')"
            )
        return "liez Dropbox ou Drive avec link_device_cloud(...)"
    return None


async def _fetch_available_methods(client: httpx.AsyncClient, device_id: str) -> list[dict[str, Any]]:
    resp = await client.get(f"/api/v1/devices/{device_id}/methods")
    _raise_for(resp)
    methods = resp.json()
    if not isinstance(methods, list):
        return []
    return [m for m in methods if isinstance(m, dict) and m.get("available")]


async def _fetch_all_methods(client: httpx.AsyncClient, device_id: str) -> list[dict[str, Any]]:
    resp = await client.get(f"/api/v1/devices/{device_id}/methods")
    _raise_for(resp)
    methods = resp.json()
    if not isinstance(methods, list):
        return []
    return [m for m in methods if isinstance(m, dict)]

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
# 21. list_deliveries
# ---------------------------------------------------------------------------

@mcp.tool
async def list_deliveries(limit: int = 20) -> str:
    """Liste les envois récents de l'utilisateur (triés du plus récent).

    Args:
        limit: Nombre maximum de livraisons à afficher (défaut 20).

    Returns:
        Par ligne : date, statut, méthode, titre, liseuse, erreur si échec.
        Rappel Amazon si au moins un envoi email est `sent`.
    """
    if limit < 1:
        limit = 1
    async with _client(_resolve_user_token()) as client:
        resp = await client.get("/api/v1/deliveries")
    _raise_for(resp)
    jobs = resp.json()
    if not isinstance(jobs, list) or not jobs:
        return "Aucun envoi enregistré."

    def _sort_key(job: dict[str, Any]) -> str:
        return str(job.get("created_at") or "")

    ordered = sorted(
        [j for j in jobs if isinstance(j, dict)],
        key=_sort_key,
        reverse=True,
    )[:limit]

    lines: list[str] = [f"Envois récents (limit={limit}, {len(ordered)} affiché(s)) :"]
    has_email_sent = False
    for job in ordered:
        if job.get("method") == "email" and job.get("status") == "sent":
            has_email_sent = True
        parts = [
            f"date: {job.get('created_at') or '?'}",
            f"status: {job.get('status')}",
            f"method: {job.get('method')}",
            f"livre: {job.get('item_title') or '?'}",
            f"liseuse: {job.get('device_label') or '?'}",
        ]
        if job.get("error"):
            parts.append(f"erreur: {job['error']}")
        if job.get("id"):
            parts.append(f"job_id: {job['id']}")
        lines.append(_kv(parts))

    if has_email_sent:
        lines.append(_AMAZON_SENT_REMINDER)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 22. plan_delivery
# ---------------------------------------------------------------------------

@mcp.tool
async def plan_delivery(
    item_id: str,
    device_id: str | None = None,
    format: str | None = None,
) -> str:
    """Dry-run : explique ce qui va se passer pour une livraison, sans l'envoyer.

    Args:
        item_id: UUID du livre (library_item_id).
        device_id: UUID d'une liseuse cible (omis = toutes les liseuses).
        format: Format cible demandé (sinon default_format puis original_format).

    Returns:
        Titre, format résolu, modes ✓/✗ par appareil, et commande exacte à appeler
        (deliver / deliver_to_kindle) ou blocage à lever.
    """
    token = _resolve_user_token()
    async with _client(token) as client:
        resp = await client.get(f"/api/v1/books/{item_id}")
        _raise_for(resp)
        book = resp.json()

        resp = await client.get("/api/v1/users/me")
        _raise_for(resp)
        profile = resp.json()

        resp = await client.get("/api/v1/devices")
        _raise_for(resp)
        devices = resp.json() if isinstance(resp.json(), list) else []
        if not isinstance(devices, list):
            devices = []

        if device_id:
            devices = [d for d in devices if str(d.get("id")) == str(device_id)]
            if not devices:
                # Peut être un 404 ownership : tenter GET direct pour message clair
                resp = await client.get(f"/api/v1/devices/{device_id}")
                _raise_for(resp)
                devices = [resp.json()]

        target_format, format_source = _resolve_target_format(
            format,
            profile.get("default_format"),
            book.get("original_format"),
        )
        profile_kindle = profile.get("kindle_email")

        lines: list[str] = [
            f"Plan de livraison (dry-run) — livre: **{book.get('title', '?')}** "
            f"(original_format: {book.get('original_format', '?')})",
            (
                f"Format cible résolu: `{target_format}` "
                f"(priorité: demandé > default_format > original_format ; "
                f"ici: {format_source})"
            ),
            f"Profil: kindle_email={profile_kindle or '(non défini)'} | "
            f"default_format={profile.get('default_format') or '(non défini)'}",
        ]

        if not devices:
            lines.append("Aucune liseuse à inspecter.")
            lines.append(
                "Blocage: enregistrez une liseuse avec add_device(...) "
                "puis réessayez plan_delivery."
            )
            return "\n".join(lines)

        any_email_ok = False
        any_method_ok = False
        kindle_targets: list[dict[str, Any]] = []

        for device in devices:
            did = str(device.get("id"))
            label = _device_label(device)
            brand = (device.get("brand") or "").lower()
            lines.append(
                f"\n**{label}** — tier: {device.get('delivery_tier')} | id: {did}"
            )
            methods = await _fetch_all_methods(client, did)
            for m in methods:
                name = m.get("method")
                if m.get("available"):
                    any_method_ok = True
                    if name == "email":
                        any_email_ok = True
                    lines.append(f"  ✓ {name} — disponible")
                else:
                    raw = m.get("reason_code")
                    reason = _format_reason_code(raw) if raw else "indisponible"
                    lines.append(f"  ✗ {name} — {reason}")
            if brand == "kindle":
                kindle_targets.append(device)
                addr = _kindle_email_for_device(device, profile_kindle)
                source = (
                    "device.email_address"
                    if (device.get("email_address") or "").strip()
                    else "kindle_email du profil"
                )
                lines.append(
                    f"  adresse Kindle utilisée: {addr or '(aucune)'} ({source})"
                )

        lines.append("")
        if device_id and len(devices) == 1:
            device = devices[0]
            did = str(device.get("id"))
            brand = (device.get("brand") or "").lower()
            if brand == "kindle" and any_email_ok:
                fmt_arg = f", format='{target_format}'" if format else ""
                lines.append(
                    "Prochaine étape: "
                    f"deliver_to_kindle(item_id='{item_id}', device_id='{did}'"
                    f"{fmt_arg}, confirm=True)"
                )
            elif any_method_ok:
                fmt_arg = f", format='{target_format}'" if format else ""
                lines.append(
                    "Prochaine étape: "
                    f"deliver(item_id='{item_id}', device_id='{did}', "
                    f"confirm=True{fmt_arg})"
                )
            else:
                lines.append(
                    "Blocage: aucun mode disponible sur cette liseuse — "
                    "corrigez les ✗ ci-dessus puis réessayez."
                )
        elif len(kindle_targets) == 1 and any_email_ok and not device_id:
            did = str(kindle_targets[0].get("id"))
            fmt_arg = f", format='{target_format}'" if format else ""
            lines.append(
                "Prochaine étape: "
                f"deliver_to_kindle(item_id='{item_id}'{fmt_arg}, confirm=True)"
            )
        elif any_method_ok:
            lines.append(
                "Prochaine étape: choisissez une liseuse puis "
                f"deliver(item_id='{item_id}', device_id='…', confirm=True) "
                "ou deliver_to_kindle(...) pour une Kindle."
            )
        else:
            lines.append(
                "Blocage: aucun mode disponible — levez les raisons ✗ "
                "(ex. update_profile / update_device / link_device_cloud) "
                "puis réessayez."
            )

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 23. diagnose
# ---------------------------------------------------------------------------

@mcp.tool
async def diagnose() -> str:
    """Agrège pourquoi un envoi Kindle ne part pas, et comment corriger.

    Interroge le profil, les réglages mail, les liseuses/méthodes, et la
    dernière livraison en échec. N'invente aucun état.

    Returns:
        Diagnostic lisible avec corrections actionnables.
    """
    token = _resolve_user_token()
    async with _client(token) as client:
        resp = await client.get("/api/v1/users/me")
        _raise_for(resp)
        profile = resp.json()

        resp = await client.get("/api/v1/mail/settings")
        _raise_for(resp)
        mail = resp.json()

        resp = await client.get("/api/v1/devices")
        _raise_for(resp)
        devices = resp.json() if isinstance(resp.json(), list) else []
        if not isinstance(devices, list):
            devices = []

        resp = await client.get("/api/v1/deliveries")
        _raise_for(resp)
        jobs = resp.json() if isinstance(resp.json(), list) else []
        if not isinstance(jobs, list):
            jobs = []

        lines: list[str] = ["Diagnostic Kindle / envoi :"]

        kindle_email = profile.get("kindle_email")
        if kindle_email:
            lines.append(f"1. kindle_email profil: défini ({kindle_email})")
        else:
            lines.append(
                "1. kindle_email profil: non défini — "
                "renseigne avec update_profile(kindle_email=…)"
            )

        configured = "oui" if mail.get("configured") else "non"
        sender = mail.get("sender_address") or "(non définie)"
        domains = mail.get("allowed_domains") or []
        domains_txt = ", ".join(str(d) for d in domains) if domains else "(aucun)"
        lines.append(
            f"2. mail: envoi configuré={configured} | "
            f"adresse à approuver chez Amazon={sender} | "
            f"domaines destinataires={domains_txt} | "
            f"quotas h/j={mail.get('hourly_quota')}/{mail.get('daily_quota')}"
        )
        if not mail.get("configured"):
            lines.append(
                "   → smtp_not_configured: côté plateforme, rien à faire "
                "côté utilisateur"
            )
        else:
            lines.append(
                "   → ajoutez l'adresse d'envoi dans la liste Amazon "
                "(voir get_mail_settings())"
            )

        if not devices:
            lines.append(
                "3. liseuses: aucune — "
                "appelez add_device(brand='kindle', name=…, email_address=…)"
            )
        else:
            lines.append(f"3. liseuses ({len(devices)}) :")
            for device in devices:
                did = str(device.get("id"))
                lines.append(
                    f"   • {_format_device_line(device)}"
                )
                methods = await _fetch_all_methods(client, did)
                for m in methods:
                    name = m.get("method")
                    if m.get("available"):
                        lines.append(f"     ✓ {name} — disponible")
                    else:
                        raw = m.get("reason_code")
                        reason = _format_reason_code(raw) if raw else "indisponible"
                        correction = _correction_for_reason(raw, device_id=did)
                        if correction:
                            lines.append(
                                f"     ✗ {name} — {reason} → correction: {correction}"
                            )
                        else:
                            lines.append(f"     ✗ {name} — {reason}")

        failed = [
            j for j in jobs
            if isinstance(j, dict) and j.get("status") == "failed"
        ]
        failed.sort(key=lambda j: str(j.get("created_at") or ""), reverse=True)
        if failed:
            last = failed[0]
            lines.append(
                "4. dernière livraison en échec: "
                + _kv(
                    [
                        f"date: {last.get('created_at')}",
                        f"livre: {last.get('item_title') or '?'}",
                        f"liseuse: {last.get('device_label') or '?'}",
                        f"erreur: {last.get('error') or '(sans détail)'}",
                        f"job_id: {last.get('id')}",
                    ]
                )
            )
        else:
            lines.append("4. dernière livraison en échec: aucune")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 24. deliver_to_kindle
# ---------------------------------------------------------------------------

@mcp.tool
async def deliver_to_kindle(
    item_id: str,
    device_id: str | None = None,
    kindle_email: str | None = None,
    format: str | None = None,
    confirm: bool = False,
) -> str:
    """Envoie un livre vers une Kindle par email (parcours explicite).

    Si `kindle_email` est fourni, il est d'abord enregistré comme adresse de
    repli du profil (PATCH /users/me). Résout ensuite la Kindle cible, vérifie
    que le mode `email` est disponible, puis dry-run ou POST /deliveries.

    Args:
        item_id: UUID du livre (library_item_id).
        device_id: UUID d'une Kindle précise (omis = auto si une seule Kindle).
        kindle_email: Adresse Send-to-Kindle de repli à enregistrer d'abord.
        format: Format cible optionnel (epub, pdf… ; le cœur convertit si besoin).
        confirm: False = dry-run ; True = déclenche l'envoi.

    Returns:
        Prévisualisation ou confirmation (job_id, statut, rappel Amazon).
    """
    token = _resolve_user_token()
    kindle_email_saved = False

    async with _client(token) as client:
        if kindle_email is not None:
            resp = await client.patch(
                "/api/v1/users/me",
                json={"kindle_email": kindle_email},
            )
            _raise_for(resp)
            kindle_email_saved = True

        resp = await client.get("/api/v1/users/me")
        _raise_for(resp)
        profile = resp.json()
        profile_kindle = profile.get("kindle_email")

        target: dict[str, Any] | None = None
        if device_id:
            resp = await client.get(f"/api/v1/devices/{device_id}")
            _raise_for(resp)
            device = resp.json()
            if (device.get("brand") or "").lower() != "kindle":
                return (
                    f"Cet appareil n'est pas un Kindle "
                    f"({_device_label(device)}) — utilise deliver "
                    f"(deliver(item_id='{item_id}', device_id='{device_id}', "
                    f"confirm=True, method=…))."
                )
            target = device
        else:
            resp = await client.get("/api/v1/devices")
            _raise_for(resp)
            devices = resp.json() if isinstance(resp.json(), list) else []
            if not isinstance(devices, list):
                devices = []
            kindles = [
                d for d in devices
                if isinstance(d, dict) and (d.get("brand") or "").lower() == "kindle"
            ]
            if len(kindles) == 0:
                email_hint = (
                    f", email_address='{kindle_email}'"
                    if kindle_email
                    else (
                        f", email_address='{profile_kindle}'"
                        if profile_kindle
                        else ""
                    )
                )
                return (
                    "Aucune Kindle enregistrée — rien n'a été créé.\n"
                    "Appelez d'abord:\n"
                    f"  add_device(brand='kindle', name='Kindle'{email_hint})\n"
                    "puis deliver_to_kindle(...)."
                )
            if len(kindles) > 1:
                listing = "\n".join(
                    f"  • {_device_label(d)} | id: {d.get('id')}" for d in kindles
                )
                return (
                    "Plusieurs Kindle trouvées — précisez device_id:\n"
                    f"{listing}\n"
                    f"Exemple: deliver_to_kindle(item_id='{item_id}', "
                    f"device_id='<id>', confirm={confirm})."
                )
            target = kindles[0]

        assert target is not None
        did = str(target.get("id"))
        label = _device_label(target)

        methods = await _fetch_all_methods(client, did)
        email_method = next(
            (m for m in methods if m.get("method") == "email"),
            None,
        )
        if email_method is None or not email_method.get("available"):
            raw = (email_method or {}).get("reason_code")
            reason = _format_reason_code(raw) if raw else "mode email indisponible"
            correction = _correction_for_reason(raw, device_id=did)
            msg = (
                f"Mode email indisponible pour {label}: {reason}."
            )
            if correction:
                msg += f"\nCorrection: {correction}"
            msg += "\nAucun POST /deliveries n'a été envoyé."
            return msg

        addr = _kindle_email_for_device(target, profile_kindle)
        addr_source = (
            "device.email_address"
            if (target.get("email_address") or "").strip()
            else "kindle_email du profil"
        )

        resp = await client.get(f"/api/v1/books/{item_id}")
        book_title = "?"
        original_format = None
        if not resp.is_error:
            book = resp.json()
            book_title = book.get("title") or "?"
            original_format = book.get("original_format")
        target_format, format_source = _resolve_target_format(
            format,
            profile.get("default_format"),
            original_format,
        )

        if not confirm:
            lines = [
                "⚠️ Envoi Kindle non confirmé (dry-run).",
                f"cible: {label} | id: {did}",
                f"adresse utilisée: {addr or '(aucune)'} ({addr_source})",
                f"format cible: {target_format} ({format_source})",
                "méthode: email",
            ]
            if kindle_email_saved:
                lines.append(
                    f"kindle_email du profil enregistré: {kindle_email}"
                )
            lines.append(_AMAZON_SENT_REMINDER)
            fmt_arg = f", format='{format}'" if format else ""
            lines.append(
                f"Appelle deliver_to_kindle(item_id='{item_id}', "
                f"device_id='{did}'{fmt_arg}, confirm=True) pour envoyer."
            )
            return "\n".join(lines)

        payload: dict[str, Any] = {
            "library_item_id": item_id,
            "device_id": did,
            "method": "email",
        }
        if format:
            payload["format"] = format

        resp = await client.post("/api/v1/deliveries", json=payload)
    _raise_for(resp)
    data = resp.json()
    parts = [
        f"job_id: {data.get('id')}",
        f"status: {data.get('status')}",
        f"livre: {data.get('item_title') or book_title}",
        f"liseuse: {data.get('device_label') or label}",
        f"format: {data.get('target_format') or target_format}",
        "method: email",
    ]
    msg = "Envoi Kindle créé.\n" + _kv(parts)
    if kindle_email_saved:
        msg += f"\nkindle_email du profil enregistré: {kindle_email}"
    msg += (
        f"\n{_AMAZON_SENT_REMINDER}\n"
        f"Suivre avec get_delivery_status(job_id='{data.get('id')}')."
    )
    return msg


# ---------------------------------------------------------------------------
# 25. search_library_items
# ---------------------------------------------------------------------------

@mcp.tool
async def search_library_items(query: str, page: int = 1, limit: int = 20) -> str:
    """Recherche **dans** la bibliothèque de l'utilisateur (titre ou auteur).

    Distinct de `search_library`, qui interroge les sources externes
    (légales + gateways). Ici on filtre uniquement les livres déjà possédés
    (`GET /api/v1/books?q=`).

    Args:
        query: Texte à chercher (insensible à la casse, titre OU auteur).
        page: Numéro de page (commence à 1).
        limit: Nombre d'éléments par page (défaut 20).

    Returns:
        Titre, auteur, format et library_item_id des correspondances.
    """
    if page < 1:
        page = 1
    if limit < 1:
        limit = 1
    async with _client(_resolve_user_token()) as client:
        resp = await client.get(
            "/api/v1/books",
            params={"q": query, "page": page, "limit": limit},
        )
    _raise_for(resp)
    data = resp.json()
    items = data.get("items") if isinstance(data, dict) else None
    if not items:
        return f"Aucun livre trouvé dans la bibliothèque pour « {query} »."
    total = data.get("total", len(items))
    lines = [
        f"Bibliothèque (recherche « {query} ») — "
        f"page {data.get('page', page)} "
        f"(total: {total})"
    ]
    for item in items:
        lines.append(
            f"**{item.get('title', '?')}** — {item.get('author') or '?'}\n"
            f"  format: {item.get('original_format', '?')} | "
            f"library_item_id: {item.get('id')}"
        )
    return "\n\n".join(lines)


# ---------------------------------------------------------------------------
# 26. update_library_item
# ---------------------------------------------------------------------------

@mcp.tool
async def update_library_item(
    item_id: str,
    title: str | None = None,
    author: str | None = None,
    description: str | None = None,
    language: str | None = None,
    page_count: int | None = None,
    publisher: str | None = None,
    published_year: int | None = None,
    isbn: str | None = None,
) -> str:
    """Met à jour les métadonnées d'un livre de la bibliothèque.

    N'envoie que les champs fournis. Refuse si aucun champ n'est fourni.

    Args:
        item_id: UUID du livre.
        title, author, description, language, page_count, publisher,
        published_year, isbn: champs optionnels à mettre à jour.

    Returns:
        Résumé du livre après mise à jour.
    """
    body: dict[str, Any] = {}
    if title is not None:
        body["title"] = title
    if author is not None:
        body["author"] = author
    if description is not None:
        body["description"] = description
    if language is not None:
        body["language"] = language
    if page_count is not None:
        body["page_count"] = page_count
    if publisher is not None:
        body["publisher"] = publisher
    if published_year is not None:
        body["published_year"] = published_year
    if isbn is not None:
        body["isbn"] = isbn
    if not body:
        raise RuntimeError(
            f"{_ERR_BAD_REQUEST}: fournir au moins un champ à mettre à jour "
            "(title, author, description, language, page_count, publisher, "
            "published_year, isbn)."
        )

    async with _client(_resolve_user_token()) as client:
        resp = await client.patch(f"/api/v1/books/{item_id}", json=body)
    _raise_for(resp)
    data = resp.json()
    return (
        "Livre mis à jour.\n"
        + _kv(
            [
                f"title: {data.get('title')}",
                f"author: {data.get('author')}",
                f"language: {data.get('language') or '—'}",
                f"isbn: {data.get('isbn') or '—'}",
                f"library_item_id: {data.get('id') or item_id}",
            ]
        )
    )


# ---------------------------------------------------------------------------
# 27. delete_library_item
# ---------------------------------------------------------------------------

@mcp.tool
async def delete_library_item(item_id: str, confirm: bool = False) -> str:
    """Supprime un livre de la bibliothèque (garde-fou confirm=True obligatoire).

    Args:
        item_id: UUID du livre.
        confirm: Doit être True pour confirmer. Si False, prévisualise seulement.

    Returns:
        Confirmation de suppression, ou message de prévisualisation.
    """
    token = _resolve_user_token()
    async with _client(token) as client:
        resp = await client.get(f"/api/v1/books/{item_id}")
        _raise_for(resp)
        book = resp.json()
        title = book.get("title") or "?"
        author = book.get("author") or "?"

        if not confirm:
            return (
                f"⚠️ Suppression non confirmée.\n"
                f"Livre concerné: **{title}** — {author} | "
                f"library_item_id: {item_id}\n"
                f"Appelle delete_library_item(item_id='{item_id}', confirm=True) "
                f"pour supprimer définitivement ce livre."
            )

        resp = await client.delete(f"/api/v1/books/{item_id}")
    _raise_for(resp)
    return f"Livre supprimé: **{title}** — {author} (id: {item_id})."


# ---------------------------------------------------------------------------
# 28. list_library_item_deliveries
# ---------------------------------------------------------------------------

@mcp.tool
async def list_library_item_deliveries(item_id: str) -> str:
    """Liste l'historique des envois pour un livre donné.

    Args:
        item_id: UUID du livre (library_item_id).

    Returns:
        Même formatage que list_deliveries (date, statut, méthode, liseuse…).
    """
    async with _client(_resolve_user_token()) as client:
        resp = await client.get(f"/api/v1/books/{item_id}/deliveries")
    _raise_for(resp)
    jobs = resp.json()
    if not isinstance(jobs, list) or not jobs:
        return f"Aucun envoi enregistré pour ce livre (id: {item_id})."

    def _sort_key(job: dict[str, Any]) -> str:
        return str(job.get("created_at") or "")

    ordered = sorted(
        [j for j in jobs if isinstance(j, dict)],
        key=_sort_key,
        reverse=True,
    )

    lines: list[str] = [
        f"Envois du livre {item_id} ({len(ordered)} enregistrement(s)) :"
    ]
    has_email_sent = False
    for job in ordered:
        if job.get("method") == "email" and job.get("status") == "sent":
            has_email_sent = True
        parts = [
            f"date: {job.get('created_at') or '?'}",
            f"status: {job.get('status')}",
            f"method: {job.get('method')}",
            f"livre: {job.get('item_title') or '?'}",
            f"liseuse: {job.get('device_label') or '?'}",
        ]
        if job.get("error"):
            parts.append(f"erreur: {job['error']}")
        if job.get("id"):
            parts.append(f"job_id: {job['id']}")
        lines.append(_kv(parts))

    if has_email_sent:
        lines.append(_AMAZON_SENT_REMINDER)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 29. download_library_item
# ---------------------------------------------------------------------------

@mcp.tool
async def download_library_item(item_id: str, format: str | None = None) -> str:
    """Obtient un lien de téléchargement signé pour un livre de la bibliothèque.

    Le client MCP ne peut pas streamer un binaire : on renvoie une URL courte
    (lien personnel, valable 15 minutes).

    Args:
        item_id: UUID du livre.
        format: Format cible (epub, mobi, azw3, pdf). Défaut = original_format.

    Returns:
        URL, format, expiration, et mention de validité 15 minutes.
    """
    body: dict[str, Any] = {}
    if format:
        _validate_choice(format.lower().lstrip("."), _DEFAULT_FORMATS, "format")
        body["format"] = format.lower().lstrip(".")

    async with _client(_resolve_user_token()) as client:
        resp = await client.post(
            f"/api/v1/books/{item_id}/download-link",
            json=body,
        )
    _raise_for(resp)
    data = resp.json()
    return (
        "Lien de téléchargement (lien personnel, valable 15 minutes).\n"
        + _kv(
            [
                f"url: {data.get('url')}",
                f"format: {data.get('format')}",
                f"expires_at: {data.get('expires_at')}",
                f"library_item_id: {item_id}",
            ]
        )
    )


# ---------------------------------------------------------------------------
# 30. create_gateway
# ---------------------------------------------------------------------------

def _format_gateway_secrets(data: dict[str, Any], *, rotated: bool = False) -> str:
    """Formate les secrets gateway (affichage unique) + marche à suivre."""
    action = "régénérés" if rotated else "créés"
    lines = [
        f"Gateway {action}. ⚠️ Ces secrets ne sont affichés qu'une seule fois — "
        "notez-les maintenant.",
        _kv(
            [
                f"gateway_id: {data.get('gateway_id')}",
                f"pairing_token: {data.get('pairing_token')}",
                f"gateway_key: {data.get('gateway_key')}",
                f"pairing_expires_at: {data.get('pairing_expires_at') or '—'}",
            ]
        ),
        "Marche à suivre :",
        "1. Installez le bundle gateway sur la machine qui héberge le catalogue local.",
        "2. Lancez le gateway avec la configuration fournie.",
        "3. Laissez-le s'appairer avec ce pairing_token (avant expiration).",
    ]
    return "\n".join(lines)


@mcp.tool
async def create_gateway(name: str = "Gateway") -> str:
    """Crée une gateway (catalogue local). Secrets affichés une seule fois.

    Args:
        name: Nom affiché de la gateway (défaut « Gateway »).

    Returns:
        gateway_id, pairing_token, gateway_key, expiration, et marche à suivre.
    """
    async with _client(_resolve_user_token()) as client:
        resp = await client.post("/api/v1/gateways", json={"name": name})
    _raise_for(resp)
    return _format_gateway_secrets(resp.json(), rotated=False)


# ---------------------------------------------------------------------------
# 31. recreate_gateway
# ---------------------------------------------------------------------------

@mcp.tool
async def recreate_gateway(gateway_id: str) -> str:
    """Régénère le code d'appairage et la clé d'accès d'une gateway.

    Les nouveaux secrets ne sont affichés qu'une seule fois (comme à la création).

    Args:
        gateway_id: UUID de la gateway.

    Returns:
        Nouveaux secrets + marche à suivre.
    """
    async with _client(_resolve_user_token()) as client:
        resp = await client.post(f"/api/v1/gateways/{gateway_id}/recreate")
    _raise_for(resp)
    return _format_gateway_secrets(resp.json(), rotated=True)


# ---------------------------------------------------------------------------
# 32. revoke_gateway
# ---------------------------------------------------------------------------

@mcp.tool
async def revoke_gateway(gateway_id: str, confirm: bool = False) -> str:
    """Révoque une gateway (garde-fou confirm=True obligatoire).

    Args:
        gateway_id: UUID de la gateway.
        confirm: Doit être True pour confirmer.

    Returns:
        Confirmation ou prévisualisation.
    """
    token = _resolve_user_token()
    async with _client(token) as client:
        resp = await client.get("/api/v1/gateways")
        _raise_for(resp)
        gateways = resp.json() if isinstance(resp.json(), list) else []
        gw = next(
            (
                g
                for g in gateways
                if str(g.get("gateway_id") or g.get("id")) == str(gateway_id)
            ),
            None,
        )
        if gw is None:
            raise RuntimeError(f"{_ERR_NOT_FOUND} (gateway {gateway_id})")
        label = gw.get("name") or "Gateway"

        if not confirm:
            return (
                f"⚠️ Révocation non confirmée.\n"
                f"Gateway concernée: **{label}** | gateway_id: {gateway_id}\n"
                f"Appelle revoke_gateway(gateway_id='{gateway_id}', confirm=True) "
                f"pour révoquer définitivement."
            )

        resp = await client.post(
            "/api/v1/gateways/revoke",
            json={"gateway_id": gateway_id},
        )
    _raise_for(resp)
    return f"Gateway révoquée: **{label}** (id: {gateway_id})."


# ---------------------------------------------------------------------------
# 33. delete_gateway
# ---------------------------------------------------------------------------

@mcp.tool
async def delete_gateway(gateway_id: str, confirm: bool = False) -> str:
    """Supprime une gateway (garde-fou confirm=True obligatoire).

    Args:
        gateway_id: UUID de la gateway.
        confirm: Doit être True pour confirmer.

    Returns:
        Confirmation ou prévisualisation.
    """
    token = _resolve_user_token()
    async with _client(token) as client:
        resp = await client.get("/api/v1/gateways")
        _raise_for(resp)
        gateways = resp.json() if isinstance(resp.json(), list) else []
        gw = next(
            (
                g
                for g in gateways
                if str(g.get("gateway_id") or g.get("id")) == str(gateway_id)
            ),
            None,
        )
        if gw is None:
            raise RuntimeError(f"{_ERR_NOT_FOUND} (gateway {gateway_id})")
        label = gw.get("name") or "Gateway"

        if not confirm:
            return (
                f"⚠️ Suppression non confirmée.\n"
                f"Gateway concernée: **{label}** | gateway_id: {gateway_id}\n"
                f"Appelle delete_gateway(gateway_id='{gateway_id}', confirm=True) "
                f"pour supprimer définitivement."
            )

        resp = await client.delete(f"/api/v1/gateways/{gateway_id}")
    _raise_for(resp)
    return f"Gateway supprimée: **{label}** (id: {gateway_id})."


# ---------------------------------------------------------------------------
# 34. list_gateway_jobs
# ---------------------------------------------------------------------------

@mcp.tool
async def list_gateway_jobs(gateway_id: str, limit: int = 20) -> str:
    """Liste les jobs récents d'une gateway (plus récents d'abord).

    Args:
        gateway_id: UUID de la gateway.
        limit: Nombre maximum de jobs (défaut 20).

    Returns:
        Même style que get_gateway_job (type, statut, library_item_id, erreur).
    """
    if limit < 1:
        limit = 1
    async with _client(_resolve_user_token()) as client:
        resp = await client.get(
            f"/api/v1/gateways/{gateway_id}/jobs",
            params={"limit": limit},
        )
    _raise_for(resp)
    jobs = resp.json()
    if not isinstance(jobs, list) or not jobs:
        return f"Aucun job pour la gateway {gateway_id}."

    lines = [f"Jobs gateway {gateway_id} (limit={limit}, {len(jobs)} affiché(s)) :"]
    for job in jobs:
        if not isinstance(job, dict):
            continue
        parts = [
            f"job_id: {job.get('job_id') or job.get('id')}",
            f"type: {job.get('type')}",
            f"status: {job.get('status')}",
        ]
        if job.get("library_item_id"):
            parts.append(f"library_item_id: {job['library_item_id']}")
        if job.get("error"):
            parts.append(f"erreur: {job['error']}")
        if job.get("attempts") is not None:
            parts.append(f"attempts: {job['attempts']}")
        lines.append(_kv(parts))
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 35. create_opds_token
# ---------------------------------------------------------------------------

@mcp.tool
async def create_opds_token(label: str = "Liseuse") -> str:
    """Crée un jeton OPDS pour une liseuse qui sait lire un catalogue.

    Le secret n'est affiché qu'une seule fois. L'`url` est le catalogue à
    saisir dans la liseuse (voie OPDS).

    Args:
        label: Libellé du jeton (défaut « Liseuse »).

    Returns:
        Secret, url du catalogue, et rappel d'affichage unique.
    """
    async with _client(_resolve_user_token()) as client:
        resp = await client.post("/api/v1/opds/tokens", json={"label": label})
    _raise_for(resp)
    data = resp.json()
    return (
        "Jeton OPDS créé. ⚠️ Le secret n'est affiché qu'une seule fois — "
        "notez-le maintenant.\n"
        "C'est la voie OPDS pour une liseuse qui sait lire un catalogue : "
        "saisissez l'URL ci-dessous dans les réglages de la liseuse.\n"
        + _kv(
            [
                f"token_id: {data.get('id')}",
                f"label: {data.get('label')}",
                f"token: {data.get('token')}",
                f"url: {data.get('url')}",
                f"created_at: {data.get('created_at')}",
            ]
        )
    )


# ---------------------------------------------------------------------------
# 36. revoke_opds_token
# ---------------------------------------------------------------------------

@mcp.tool
async def revoke_opds_token(token_id: str, confirm: bool = False) -> str:
    """Révoque un jeton OPDS (garde-fou confirm=True obligatoire).

    Args:
        token_id: UUID du jeton (voir list_opds_tokens).
        confirm: Doit être True pour confirmer.

    Returns:
        Confirmation ou prévisualisation.
    """
    token = _resolve_user_token()
    async with _client(token) as client:
        resp = await client.get("/api/v1/opds/tokens")
        _raise_for(resp)
        tokens = resp.json() if isinstance(resp.json(), list) else []
        row = next(
            (t for t in tokens if str(t.get("id")) == str(token_id)),
            None,
        )
        if row is None:
            raise RuntimeError(f"{_ERR_NOT_FOUND} (token OPDS {token_id})")
        label = row.get("label") or "OPDS"

        if not confirm:
            return (
                f"⚠️ Révocation non confirmée.\n"
                f"Jeton concerné: **{label}** | token_id: {token_id}\n"
                f"Appelle revoke_opds_token(token_id='{token_id}', confirm=True) "
                f"pour révoquer définitivement."
            )

        resp = await client.post(
            "/api/v1/opds/tokens/revoke",
            json={"token_id": token_id},
        )
    _raise_for(resp)
    return f"Jeton OPDS révoqué: **{label}** (id: {token_id})."


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------

def _http_middleware_and_origins(settings) -> tuple[list, list[str] | None]:
    """CORS + origines pour HostOriginGuard (extension FastMCP 4 / Starlette).

    Liste fermée d'origines MCP clients non tenable (Cursor, Claude Desktop,
    IDE, extensions…). Choix : `allow_origins=["*"]` avec
    `allow_credentials=False`. Si `MCP_ALLOWED_ORIGINS` est une liste CSV
    (pas `*`), elle sert à la fois au CORS et au refus d'Origin inconnue.
    """
    from starlette.middleware import Middleware
    from starlette.middleware.cors import CORSMiddleware

    raw = (settings.mcp_allowed_origins or "*").strip()
    if raw == "*" or not raw:
        cors_origins: list[str] = ["*"]
        guard_origins: list[str] | None = None
    else:
        cors_origins = [o.strip() for o in raw.split(",") if o.strip()]
        guard_origins = cors_origins

    middleware = [
        Middleware(
            CORSMiddleware,
            allow_origins=cors_origins,
            allow_credentials=False,
            allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
            allow_headers=[
                "mcp-protocol-version",
                "mcp-session-id",
                "mcp-method",
                "mcp-name",
                "Authorization",
                "Content-Type",
            ],
            expose_headers=["mcp-session-id"],
        )
    ]
    return middleware, guard_origins


def main() -> None:
    """Démarre le serveur HTTP streamable (protocole MCP 2026-07-28 / legacy).

    FastMCP 4 conserve `run_http_async` : transport streamable-http, mode
    stateless, chemin `/mcp`. La négociation d'ère (discover vs initialize)
    est gérée par le SDK `mcp` 2.x par connexion.
    """
    settings = get_settings()
    middleware, allowed_origins = _http_middleware_and_origins(settings)
    from urllib.parse import urlparse

    base = settings.mcp_base_url.rstrip("/")
    host = urlparse(base).hostname

    # Liste fermée : refuse Origin inconnue + Host guard.
    # Mode "*" : CORS permissif (sans credentials) ; host_origin_protection=auto
    # ne valide Origin que sur loopback (Traefik filtre déjà le Host en prod).
    if allowed_origins is not None:
        asyncio.run(
            mcp.run_http_async(
                transport="streamable-http",
                host="0.0.0.0",
                port=settings.port,
                path="/mcp",
                stateless_http=True,
                middleware=middleware,
                host_origin_protection=True,
                allowed_hosts=[host] if host else None,
                allowed_origins=allowed_origins,
            )
        )
    else:
        asyncio.run(
            mcp.run_http_async(
                transport="streamable-http",
                host="0.0.0.0",
                port=settings.port,
                path="/mcp",
                stateless_http=True,
                middleware=middleware,
                host_origin_protection="auto",
            )
        )


if __name__ == "__main__":
    main()
