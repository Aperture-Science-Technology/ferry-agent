"""Upload d'ebooks vers un stockage cloud (Dropbox / Google Drive) pour la
livraison tier B : l'utilisateur recupere le fichier depuis l'app native de
son cloud sur sa liseuse (Kobo haut de gamme), puis tape "Sync".

Les credentials OAuth (client_id/secret) sont de la config runtime (env,
cf. config.py) ; ce module ne stocke jamais de secret en dur. `Device.link_ref`
contient le JSON produit par le linking OAuth (voir api/devices.py),
**chiffre au repos** via Fernet (`services.crypto`) :
- Dropbox : `{"provider": "dropbox", "token": "<access_token>"}`
- Drive   : `{"provider": "drive", "refresh_token": "<refresh_token>"}`
  (l'access_token Drive expire vite ; on repart toujours du refresh_token).
"""

import json
import logging
from typing import Any
from urllib.parse import urlencode

import httpx

from ferry_agent.config import get_settings
from ferry_agent.services import crypto

logger = logging.getLogger(__name__)

DROPBOX_AUTHORIZE_URL = "https://www.dropbox.com/oauth2/authorize"
DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token"
DROPBOX_UPLOAD_URL = "https://content.dropboxapi.com/2/files/upload"

GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"
GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"


class CloudLinkError(Exception):
    """Echec d'upload ou d'auth cloud (token expire/invalide, reseau, provider inconnu)."""


# --- URLs d'autorisation --------------------------------------------------


def dropbox_authorize_url(client_id: str, redirect_uri: str, state: str) -> str:
    params = {
        "client_id": client_id,
        "token_access_type": "offline",
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "state": state,
    }
    return f"{DROPBOX_AUTHORIZE_URL}?{urlencode(params)}"


def drive_authorize_url(client_id: str, redirect_uri: str, state: str) -> str:
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": GOOGLE_DRIVE_SCOPE,
        "response_type": "code",
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{GOOGLE_AUTHORIZE_URL}?{urlencode(params)}"


# --- Echange code -> tokens ------------------------------------------------


async def exchange_dropbox_code(
    code: str,
    client_id: str,
    client_secret: str,
    redirect_uri: str,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> dict[str, Any]:
    data = {
        "code": code,
        "grant_type": "authorization_code",
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
    }
    async with httpx.AsyncClient(transport=transport, timeout=30) as client:
        response = await client.post(DROPBOX_TOKEN_URL, data=data)
    if response.status_code >= 400:
        raise CloudLinkError(f"echange de code Dropbox echoue ({response.status_code}): {response.text}")
    return response.json()


async def exchange_drive_code(
    code: str,
    client_id: str,
    client_secret: str,
    redirect_uri: str,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> dict[str, Any]:
    data = {
        "code": code,
        "grant_type": "authorization_code",
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
    }
    async with httpx.AsyncClient(transport=transport, timeout=30) as client:
        response = await client.post(GOOGLE_TOKEN_URL, data=data)
    if response.status_code >= 400:
        raise CloudLinkError(f"echange de code Google Drive echoue ({response.status_code}): {response.text}")
    return response.json()


# --- Dropbox ----------------------------------------------------------------


async def upload_to_dropbox(
    access_token: str,
    remote_path: str,
    file_bytes: bytes,
    filename: str,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Dropbox-API-Arg": json.dumps({"path": remote_path, "mode": "add", "autorename": True}),
        "Content-Type": "application/octet-stream",
    }
    async with httpx.AsyncClient(transport=transport, timeout=60) as client:
        response = await client.post(DROPBOX_UPLOAD_URL, headers=headers, content=file_bytes)
    if response.status_code == 401:
        raise CloudLinkError(f"token Dropbox invalide/expire pour {filename} (401, a relier)")
    if response.status_code >= 400:
        raise CloudLinkError(f"upload Dropbox echoue ({response.status_code}): {response.text}")
    return response.json()


# --- Google Drive -------------------------------------------------------


async def get_drive_access(
    refresh_token: str,
    client_id: str,
    client_secret: str,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> str:
    data = {
        "grant_type": "refresh_token",
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
    }
    async with httpx.AsyncClient(transport=transport, timeout=30) as client:
        response = await client.post(GOOGLE_TOKEN_URL, data=data)
    if response.status_code == 401:
        raise CloudLinkError("refresh token Google Drive invalide/revoque (401, a relier)")
    if response.status_code >= 400:
        raise CloudLinkError(f"rafraichissement du token Google Drive echoue ({response.status_code}): {response.text}")
    access_token = response.json().get("access_token")
    if not access_token:
        raise CloudLinkError("reponse token Google Drive sans access_token")
    return access_token


async def upload_to_drive(
    access_token: str,
    filename: str,
    file_bytes: bytes,
    mime: str = "application/epub+zip",
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> str:
    files = {
        "metadata": ("metadata", json.dumps({"name": filename}), "application/json; charset=UTF-8"),
        "file": (filename, file_bytes, mime),
    }
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(transport=transport, timeout=60) as client:
        response = await client.post(GOOGLE_UPLOAD_URL, headers=headers, files=files)
    if response.status_code == 401:
        raise CloudLinkError(f"token Google Drive invalide/expire pour {filename} (401, a relier)")
    if response.status_code >= 400:
        raise CloudLinkError(f"upload Google Drive echoue ({response.status_code}): {response.text}")
    file_id = response.json().get("id")
    if not file_id:
        raise CloudLinkError("reponse upload Google Drive sans id de fichier")
    return file_id


# --- Selection par provider -----------------------------------------------


def serialize_link_ref(link_ref: dict[str, str]) -> str:
    """Serialise et chiffre le JSON link_ref pour stockage en base."""
    plaintext = json.dumps(link_ref, separators=(",", ":"))
    try:
        return crypto.encrypt(plaintext)
    except crypto.CryptoError as exc:
        raise CloudLinkError("chiffrement link_ref impossible (FERNET_KEY manquante)") from exc


def parse_link_ref(link_ref_json: str) -> dict[str, str]:
    """Dechiffre (si besoin) et parse `Device.link_ref`.

    Accepte encore un JSON en clair (lignes pre-migration). Un jeton
    indechiffrable ou un JSON corrompu leve `CloudLinkError` — l'API
    degrade en `cloud_linked=false`, jamais en 500.
    """
    raw = link_ref_json
    try:
        raw = crypto.decrypt(link_ref_json)
    except crypto.CryptoError:
        # Pas de cle, cle incorrecte, ou valeur legacy en clair.
        pass

    try:
        data = json.loads(raw)
    except (TypeError, json.JSONDecodeError) as exc:
        raise CloudLinkError("link_ref invalide (JSON illisible ou chiffre illisible)") from exc
    if data.get("provider") not in ("dropbox", "drive"):
        raise CloudLinkError(f"provider cloud inconnu: {data.get('provider')!r}")
    return data


async def upload_job_file(
    link_ref_json: str,
    filename: str,
    file_bytes: bytes,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> str:
    """Dispatche l'upload vers le provider stocke dans `Device.link_ref`.

    Retourne un identifiant/chemin distant pour la trace (log + suivi du job).
    """
    link_ref = parse_link_ref(link_ref_json)

    if link_ref["provider"] == "dropbox":
        access_token = link_ref.get("token")
        if not access_token:
            raise CloudLinkError("link_ref dropbox sans token")
        remote_path = f"/{filename}"
        result = await upload_to_dropbox(access_token, remote_path, file_bytes, filename, transport=transport)
        return result.get("path_display") or remote_path

    refresh_token = link_ref.get("refresh_token")
    if not refresh_token:
        raise CloudLinkError("link_ref drive sans refresh_token")

    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        raise CloudLinkError("Google Drive non configure (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET manquants)")

    access_token = await get_drive_access(
        refresh_token, settings.google_client_id, settings.google_client_secret, transport=transport
    )
    file_id = await upload_to_drive(access_token, filename, file_bytes, transport=transport)
    return f"drive:{file_id}"
