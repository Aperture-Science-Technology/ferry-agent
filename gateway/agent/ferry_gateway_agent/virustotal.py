import hashlib
from pathlib import Path
from typing import Any

import httpx


class VirusTotalThreatError(RuntimeError):
    pass


class VirusTotalClient:
    def __init__(
        self,
        api_key: str,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(timeout=60)
        self.headers = {"x-apikey": api_key}
        self.base_url = "https://www.virustotal.com/api/v3"

    @staticmethod
    def sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as file:
            for chunk in iter(lambda: file.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    async def scan(self, path: Path) -> dict[str, Any] | None:
        digest = self.sha256(path)
        response = await self._client.get(
            f"{self.base_url}/files/{digest}",
            headers=self.headers,
        )
        if response.status_code == 404:
            with path.open("rb") as file:
                upload = await self._client.post(
                    f"{self.base_url}/files",
                    headers=self.headers,
                    files={"file": (path.name, file, "application/octet-stream")},
                )
            upload.raise_for_status()
            return upload.json()

        response.raise_for_status()
        report = response.json()
        stats = (
            report.get("data", {})
            .get("attributes", {})
            .get("last_analysis_stats", {})
        )
        malicious = int(stats.get("malicious") or 0)
        suspicious = int(stats.get("suspicious") or 0)
        if malicious or suspicious:
            raise VirusTotalThreatError(
                f"VirusTotal flagged {path.name}: "
                f"{malicious} malicious, {suspicious} suspicious"
            )
        return report

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()
