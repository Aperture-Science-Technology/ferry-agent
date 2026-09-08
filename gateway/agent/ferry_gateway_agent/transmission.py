import asyncio
import base64
import time
from typing import Any, Mapping

import httpx


class TransmissionError(RuntimeError):
    pass


class TransmissionClient:
    def __init__(
        self,
        base_url: str,
        *,
        username: str | None = None,
        password: str | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.rpc_url = f"{base_url.rstrip('/')}/transmission/rpc"
        self.session_id: str | None = None
        self._owns_client = client is None
        self._auth = httpx.BasicAuth(username, password or "") if username else None
        self._client = client or httpx.AsyncClient(timeout=30)

    async def _rpc(
        self,
        method: str,
        arguments: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload = {"method": method, "arguments": arguments or {}}
        for attempt in range(2):
            headers = {}
            if self.session_id:
                headers["X-Transmission-Session-Id"] = self.session_id
            response = await self._client.post(
                self.rpc_url,
                json=payload,
                headers=headers,
                auth=self._auth,
            )
            if response.status_code == 409 and attempt == 0:
                session_id = response.headers.get("X-Transmission-Session-Id")
                if not session_id:
                    raise TransmissionError(
                        "Transmission returned 409 without a session id"
                    )
                self.session_id = session_id
                continue
            response.raise_for_status()
            body = response.json()
            if body.get("result") != "success":
                raise TransmissionError(
                    f"Transmission {method} failed: {body.get('result', 'unknown error')}"
                )
            return body.get("arguments") or {}
        raise TransmissionError("Transmission session negotiation failed")

    async def _fetch_torrent_metainfo(
        self,
        url: str,
        *,
        headers: Mapping[str, str] | None = None,
    ) -> str:
        response = await self._client.get(
            url,
            headers=dict(headers) if headers else None,
            follow_redirects=True,
        )
        if not response.is_success:
            raise TransmissionError(
                f"Could not fetch torrent from {url}: HTTP {response.status_code}"
            )
        return base64.b64encode(response.content).decode("ascii")

    async def add(
        self,
        magnet_url: str,
        *,
        paused: bool = True,
        headers: Mapping[str, str] | None = None,
    ) -> int:
        if magnet_url.startswith(("http://", "https://")):
            metainfo = await self._fetch_torrent_metainfo(magnet_url, headers=headers)
            add_arguments: dict[str, Any] = {"metainfo": metainfo, "paused": paused}
        else:
            # magnet: and any other non-HTTP reference stay on the filename path.
            add_arguments = {"filename": magnet_url, "paused": paused}
        arguments = await self._rpc("torrent-add", add_arguments)
        torrent = arguments.get("torrent-added") or arguments.get("torrent-duplicate")
        if not torrent or "id" not in torrent:
            raise TransmissionError("Transmission did not return a torrent id")
        return int(torrent["id"])

    async def start(self, torrent_id: int) -> None:
        await self._rpc("torrent-start", {"ids": [torrent_id]})

    async def get(self, torrent_id: int) -> dict[str, Any]:
        arguments = await self._rpc(
            "torrent-get",
            {
                "ids": [torrent_id],
                "fields": [
                    "id",
                    "name",
                    "status",
                    "percentDone",
                    "error",
                    "errorString",
                    "downloadDir",
                    "files",
                ],
            },
        )
        torrents = arguments.get("torrents") or []
        if not torrents:
            raise TransmissionError(f"Torrent {torrent_id} was not found")
        return torrents[0]

    async def wait_until_done(
        self,
        torrent_id: int,
        *,
        timeout_seconds: float,
        poll_interval_seconds: float = 2,
    ) -> dict[str, Any]:
        deadline = time.monotonic() + timeout_seconds
        while True:
            torrent = await self.get(torrent_id)
            if int(torrent.get("error") or 0) != 0:
                raise TransmissionError(
                    f"Torrent {torrent_id} failed: "
                    f"{torrent.get('errorString') or 'unknown error'}"
                )
            if float(torrent.get("percentDone") or 0) >= 1:
                return torrent
            if time.monotonic() >= deadline:
                raise TimeoutError(f"Torrent {torrent_id} download timed out")
            await asyncio.sleep(poll_interval_seconds)

    async def remove(
        self,
        torrent_id: int,
        *,
        delete_local_data: bool = True,
    ) -> None:
        await self._rpc(
            "torrent-remove",
            {
                "ids": [torrent_id],
                "delete-local-data": delete_local_data,
            },
        )

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()
