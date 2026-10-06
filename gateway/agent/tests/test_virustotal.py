import hashlib

import httpx
import pytest
from ferry_gateway_agent.virustotal import VirusTotalClient, VirusTotalThreatError


async def test_unknown_hash_does_not_upload_the_file(tmp_path):
    path = tmp_path / "book.epub"
    path.write_bytes(b"private ebook")
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(404 if request.method == "GET" else 200, json={})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        report = await VirusTotalClient("key", client=client).scan(path)
    assert [request.method for request in requests] == ["GET"]
    assert requests[0].url.path.endswith(hashlib.sha256(b"private ebook").hexdigest())
    assert report is None


@pytest.mark.parametrize("malicious,suspicious", [(1, 0), (0, 1)])
async def test_flagged_report_raises(tmp_path, malicious, suspicious):
    path = tmp_path / "book.epub"
    path.write_bytes(b"ebook")
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={
        "data": {"attributes": {"last_analysis_stats": {
            "malicious": malicious, "suspicious": suspicious,
        }}},
    }))
    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(VirusTotalThreatError, match="book.epub"):
            await VirusTotalClient("key", client=client).scan(path)
