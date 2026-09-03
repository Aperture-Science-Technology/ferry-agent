"""Serveur MCP Ferry Agent — wrapper mince du core REST.

Expose 5 outils :
  1. search_library      — recherche de livres
  2. add_to_library      — ajout à la bibliothèque
  3. list_devices        — liste des liseuses
  4. deliver             — livraison (avec garde-fou confirm)
  5. get_delivery_status — statut d'un job de livraison
"""

import asyncio
import logging

import httpx
from fastmcp import FastMCP

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
        "Ferry Agent MCP : gérez votre bibliothèque d'ebooks et envoyez-les "
        "sur vos liseuses. Utilisez search_library pour chercher, "
        "add_to_library pour ajouter, list_devices pour voir vos appareils, "
        "deliver (avec confirm=True) pour envoyer, get_delivery_status pour suivre."
    ),
)

_USER_AGENT = "ferry-agent-mcp"


def _client() -> httpx.AsyncClient:
    settings = get_settings()
    headers = {
        "User-Agent": _USER_AGENT,
        "X-API-Key": settings.mcp_api_key,
    }
    return httpx.AsyncClient(base_url=settings.ferry_core_url, headers=headers, timeout=30.0)


def _raise_for(resp: httpx.Response) -> None:
    if resp.is_error:
        raise RuntimeError(f"core HTTP {resp.status_code}: {resp.text[:400]}")


# ---------------------------------------------------------------------------
# 1. search_library
# ---------------------------------------------------------------------------

@mcp.tool
async def search_library(query: str) -> str:
    """Recherche des ebooks dans les sources légales et les gateways appairées.

    Args:
        query: Titre, auteur ou mots-clés à rechercher.

    Returns:
        Liste lisible des résultats (titre, auteur, source, format, taille).
    """
    async with _client() as client:
        resp = await client.post("/api/v1/books/search", json={"query": query})
    _raise_for(resp)
    results = resp.json()
    if not results:
        return "Aucun résultat trouvé."
    lines = [f"**{r['title']}** — {r.get('author', '?')}\n"
             f"  source: {r['source']} | format: {r.get('format', '?')} | "
             f"taille: {r.get('size_bytes', 0) // 1024} Ko | id: {r['result_id']}"
             for r in results]
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
    async with _client() as client:
        resp = await client.post("/api/v1/books", json={"source": source, "result_id": result_id})
    _raise_for(resp)
    data = resp.json()
    if "id" in data:
        return f"Livre ajouté. library_item_id: {data['id']}"
    if "gateway_job_id" in data:
        return (
            f"Récupération via gateway en cours (asynchrone).\n"
            f"gateway_job_id: {data['gateway_job_id']} — status: {data.get('status')}"
        )
    return str(data)


# ---------------------------------------------------------------------------
# 3. list_devices
# ---------------------------------------------------------------------------

@mcp.tool
async def list_devices() -> str:
    """Liste les liseuses enregistrées avec leur tier de livraison et leur état de liaison cloud.

    Returns:
        Description lisible de chaque liseuse (marque, modèle, tier, lien cloud).
    """
    async with _client() as client:
        resp = await client.get("/api/v1/devices")
    _raise_for(resp)
    devices = resp.json()
    if not devices:
        return "Aucune liseuse enregistrée."
    lines = []
    for d in devices:
        linked = "✓ cloud lié" if d.get("link_ref") else "✗ cloud non lié"
        lines.append(
            f"**{d.get('brand', '?')} {d.get('model') or ''}** — "
            f"tier: {d.get('delivery_tier')} | {linked} | id: {d['id']}"
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 4. deliver
# ---------------------------------------------------------------------------

@mcp.tool
async def deliver(item_id: str, device_id: str, confirm: bool = False) -> str:
    """Envoie un livre vers une liseuse.

    Un garde-fou oblige à passer confirm=True pour déclencher réellement l'envoi.

    Args:
        item_id:   UUID du livre dans la bibliothèque (library_item_id).
        device_id: UUID de la liseuse cible.
        confirm:   Doit être True pour confirmer l'envoi. Si False, l'outil refuse.

    Returns:
        Confirmation de l'envoi avec le statut du job, ou message de refus.
    """
    if not confirm:
        # Récupère le nom de la liseuse pour un message plus explicite
        device_label = device_id
        try:
            async with _client() as client:
                resp = await client.get("/api/v1/devices")
            if not resp.is_error:
                for d in resp.json():
                    if d.get("id") == device_id:
                        device_label = f"{d.get('brand', '')} {d.get('model') or ''}".strip()
                        break
        except Exception:
            pass
        return (
            f"⚠️ Livraison non confirmée.\n"
            f"Appelle deliver(item_id='{item_id}', device_id='{device_id}', confirm=True) "
            f"pour envoyer vers {device_label}."
        )

    async with _client() as client:
        resp = await client.post(
            "/api/v1/deliveries",
            json={"library_item_id": item_id, "device_id": device_id},
        )
    _raise_for(resp)
    data = resp.json()
    msg = (
        f"Job de livraison créé.\n"
        f"job_id: {data['id']} | status: {data.get('status')}"
    )
    if data.get("download_url"):
        msg += f"\nURL de téléchargement (tier C): {data['download_url']}"
    return msg


# ---------------------------------------------------------------------------
# 5. get_delivery_status
# ---------------------------------------------------------------------------

@mcp.tool
async def get_delivery_status(job_id: str) -> str:
    """Retourne le statut d'un job de livraison.

    Args:
        job_id: UUID du job retourné par deliver.

    Returns:
        Statut, horodatage de livraison (si disponible) et éventuelle erreur.
    """
    async with _client() as client:
        resp = await client.get(f"/api/v1/deliveries/{job_id}")
    _raise_for(resp)
    data = resp.json()
    parts = [f"status: {data.get('status')}"]
    if data.get("delivered_at"):
        parts.append(f"livré le: {data['delivered_at']}")
    if data.get("error"):
        parts.append(f"erreur: {data['error']}")
    if data.get("download_url"):
        parts.append(f"URL: {data['download_url']}")
    return " | ".join(parts)


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
