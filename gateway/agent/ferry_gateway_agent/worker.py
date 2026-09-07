import asyncio
import json
import logging
import mimetypes
import os
import time
from pathlib import Path
from typing import Any

import httpx

from .config import Settings
from .prowlarr import ProwlarrClient
from .transmission import TransmissionClient
from .virustotal import VirusTotalClient

logger = logging.getLogger("ferry-gateway-agent")


class PlatformConflict(RuntimeError):
    """The platform no longer accepts the current operation."""


class GatewayAgent:
    def __init__(
        self,
        settings: Settings,
        *,
        platform_client: httpx.AsyncClient | None = None,
        prowlarr: ProwlarrClient | None = None,
        transmission: TransmissionClient | None = None,
        virustotal: VirusTotalClient | None = None,
    ) -> None:
        self.settings = settings
        self._owns_platform_client = platform_client is None
        self.platform = platform_client or httpx.AsyncClient(timeout=60)
        self.prowlarr = prowlarr or ProwlarrClient(
            settings.prowlarr_url,
            settings.prowlarr_api_key,
        )
        self.transmission = transmission or TransmissionClient(
            settings.transmission_url,
            username=settings.transmission_user,
            password=settings.transmission_password,
        )
        self.virustotal = virustotal
        if self.virustotal is None and settings.virustotal_api_key:
            self.virustotal = VirusTotalClient(settings.virustotal_api_key)

        state = self._load_state()
        self.gateway_id = settings.gateway_id or state.get("gateway_id")
        self.gateway_key = settings.gateway_key or state.get("gateway_key")

    @property
    def heartbeat_path(self) -> Path:
        return self.settings.state_path.parent / "heartbeat"

    def _load_state(self) -> dict[str, str]:
        try:
            body = json.loads(self.settings.state_path.read_text(encoding="utf-8"))
            if isinstance(body, dict):
                return {
                    key: str(value)
                    for key, value in body.items()
                    if key in {"gateway_id", "gateway_key"} and value
                }
        except FileNotFoundError:
            pass
        except (OSError, json.JSONDecodeError) as error:
            logger.warning("Could not read gateway state: %s", error)
        return {}

    def _atomic_write_text(self, path: Path, contents: str, *, mode: int = 0o600) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = Path(str(path) + ".tmp")
        temporary.write_text(contents, encoding="utf-8")
        os.chmod(temporary, mode)
        temporary.replace(path)

    def _save_state(self) -> None:
        self._atomic_write_text(
            self.settings.state_path,
            json.dumps(
                {
                    "gateway_id": self.gateway_id,
                    "gateway_key": self.gateway_key,
                },
                indent=2,
            )
            + "\n",
        )

    def _write_heartbeat(self) -> None:
        """Record liveness for the image HEALTHCHECK (one unix timestamp line)."""
        self._atomic_write_text(self.heartbeat_path, f"{time.time():.6f}\n")

    async def pair(self) -> None:
        if self.gateway_id:
            if not self.gateway_key:
                raise RuntimeError("GATEWAY_KEY is required for a paired gateway")
            self._save_state()
            self._write_heartbeat()
            return
        if not self.settings.pairing_token:
            raise RuntimeError(
                "Set PAIRING_TOKEN for first use, or GATEWAY_ID and GATEWAY_KEY"
            )
        if not self.gateway_key:
            raise RuntimeError(
                "GATEWAY_KEY must accompany PAIRING_TOKEN on first use"
            )

        response = await self.platform.post(
            f"{self.settings.platform_url}/api/v1/gateways/pair",
            json={"pairing_token": self.settings.pairing_token},
        )
        self._raise_platform_status(response, "pair gateway")
        body = response.json()
        gateway_id = body.get("gateway_id")
        if not gateway_id:
            raise RuntimeError("Pairing response did not contain gateway_id")
        self.gateway_id = str(gateway_id)
        self.gateway_key = str(body.get("gateway_key") or self.gateway_key)
        self._save_state()
        self._write_heartbeat()
        logger.info("Gateway %s paired", self.gateway_id)

    @staticmethod
    def _raise_platform_status(response: httpx.Response, operation: str) -> None:
        if response.status_code in {404, 409}:
            detail = response.text.strip() or "no detail"
            raise PlatformConflict(
                f"Platform returned HTTP {response.status_code} while trying to "
                f"{operation}: {detail}"
            )
        response.raise_for_status()

    def _gateway_headers(self) -> dict[str, str]:
        if not self.gateway_key:
            raise RuntimeError("Gateway is not paired")
        return {"X-Gateway-Key": self.gateway_key}

    async def poll_once(self) -> dict[str, Any] | None:
        """Poll for one job. Platform returns GatewayJobOut JSON or HTTP 204."""
        response = await self.platform.post(
            f"{self.settings.platform_url}/api/v1/gateways/poll",
            headers=self._gateway_headers(),
        )
        self._raise_platform_status(response, "poll jobs")
        if response.status_code == 204 or not response.content:
            return None
        body = response.json()
        return body if isinstance(body, dict) else None

    async def handle_job(self, job: dict[str, Any]) -> None:
        job_id = job.get("id") or job.get("job_id")
        job_type = job.get("type")
        payload = job.get("payload") or {}
        if not job_id:
            raise ValueError("Polled job has no id")
        if job_type == "search":
            await self._handle_search(str(job_id), payload)
        elif job_type == "fetch":
            await self._handle_fetch(str(job_id), payload)
        else:
            raise ValueError(f"Unsupported gateway job type: {job_type!r}")

    async def _handle_search(self, job_id: str, payload: dict[str, Any]) -> None:
        query = str(payload.get("query") or "").strip()
        if not query:
            raise ValueError("Search job payload has no query")
        results = await self.prowlarr.search(query)
        response = await self.platform.post(
            f"{self.settings.platform_url}/api/v1/gateways/jobs/"
            f"{job_id}/search-results",
            headers=self._gateway_headers(),
            json=results,
        )
        self._raise_platform_status(response, f"submit search job {job_id}")

    def _resolve_downloaded_file(self, torrent: dict[str, Any]) -> Path:
        configured_root = self.settings.download_path.resolve()
        download_dir = Path(str(torrent.get("downloadDir") or configured_root)).resolve()
        candidates: list[tuple[int, Path]] = []
        for file_info in torrent.get("files") or []:
            if not isinstance(file_info, dict) or not file_info.get("name"):
                continue
            length = int(file_info.get("length") or 0)
            completed = int(file_info.get("bytesCompleted") or 0)
            if length > 0 and completed < length:
                continue
            candidate = (download_dir / str(file_info["name"])).resolve()
            try:
                candidate.relative_to(configured_root)
            except ValueError:
                logger.warning("Ignoring file outside DOWNLOAD_PATH: %s", candidate)
                continue
            if candidate.is_file():
                candidates.append((length or candidate.stat().st_size, candidate))
        if not candidates:
            raise FileNotFoundError("Transmission reported no completed readable file")
        return max(candidates, key=lambda item: item[0])[1]

    async def _handle_fetch(self, job_id: str, payload: dict[str, Any]) -> None:
        result = payload.get("result") or {}
        download_ref = (
            result.get("magnet_url")
            or result.get("magnetUrl")
            or result.get("result_id")
            or result.get("guid")
        )
        if not download_ref:
            raise ValueError("Fetch job result has no download reference")

        torrent_id: int | None = None
        try:
            torrent_id = await self.transmission.add(str(download_ref), paused=True)
            await self.transmission.start(torrent_id)
            torrent = await self.transmission.wait_until_done(
                torrent_id,
                timeout_seconds=self.settings.download_timeout_minutes * 60,
                poll_interval_seconds=self.settings.transmission_poll_seconds,
            )
            path = self._resolve_downloaded_file(torrent)
            if self.virustotal:
                await self.virustotal.scan(path)
            content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            with path.open("rb") as file:
                response = await self.platform.post(
                    f"{self.settings.platform_url}/api/v1/gateways/jobs/"
                    f"{job_id}/fetch-result",
                    headers=self._gateway_headers(),
                    files={"file": (path.name, file, content_type)},
                )
            self._raise_platform_status(response, f"upload fetch job {job_id}")
        finally:
            if torrent_id is not None:
                try:
                    await self.transmission.remove(
                        torrent_id,
                        delete_local_data=True,
                    )
                except Exception:
                    logger.exception("Could not clean up torrent %s", torrent_id)

    async def run_once(self) -> bool:
        job: dict[str, Any] | None = None
        handled = False
        try:
            job = await self.poll_once()
            if job:
                await self.handle_job(job)
                handled = True
        except PlatformConflict as error:
            logger.warning("%s; polling will continue", error)
        except (httpx.HTTPError, OSError, TimeoutError, ValueError, RuntimeError):
            job_id = (job or {}).get("id") or (job or {}).get("job_id")
            job_type = (job or {}).get("type")
            logger.exception(
                "Gateway cycle failed for job type=%s id=%s; polling will continue",
                job_type,
                job_id,
            )
        finally:
            # Alive signal even when there is no job (False) or the cycle failed.
            self._write_heartbeat()
        return handled

    async def run(self) -> None:
        while not self.gateway_id:
            try:
                await self.pair()
            except PlatformConflict as error:
                logger.warning("%s; pairing will be retried", error)
            except httpx.HTTPError:
                logger.exception("Pairing request failed; pairing will be retried")
            if not self.gateway_id:
                await asyncio.sleep(self.settings.poll_interval_seconds)
        while True:
            await self.run_once()
            await asyncio.sleep(self.settings.poll_interval_seconds)

    async def aclose(self) -> None:
        await self.prowlarr.aclose()
        await self.transmission.aclose()
        if self.virustotal:
            await self.virustotal.aclose()
        if self._owns_platform_client:
            await self.platform.aclose()


async def async_main() -> None:
    settings = Settings()
    agent = GatewayAgent(settings)
    try:
        await agent.run()
    finally:
        await agent.aclose()


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
