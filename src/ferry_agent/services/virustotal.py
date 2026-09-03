"""Verification VirusTotal hash-first, optionnelle et non bloquante en panne."""

import hashlib
import logging

import httpx

logger = logging.getLogger(__name__)


async def is_known_malicious(
    content: bytes,
    api_key: str | None,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> bool:
    if not api_key:
        return False

    digest = hashlib.sha256(content).hexdigest()
    try:
        async with httpx.AsyncClient(
            base_url="https://www.virustotal.com/api/v3",
            headers={"x-apikey": api_key},
            transport=transport,
            timeout=10,
        ) as client:
            response = await client.get(f"/files/{digest}")
        if response.status_code == 404:
            return False
        response.raise_for_status()
        stats = response.json()["data"]["attributes"]["last_analysis_stats"]
        return int(stats.get("malicious", 0)) + int(stats.get("suspicious", 0)) > 0
    except Exception:
        logger.warning("VirusTotal indisponible pour %s; import poursuivi", digest, exc_info=True)
        return False
