"""Tests des routes de sante publiques.

Ces routes ne doivent necessiter ni base de donnees ni Calibre : le
`TestClient` declenche le lifespan de l'app (cf. `main.py`), qui se limite a
creer un moteur SQLAlchemy (sans se connecter) et logguer l'etat des
connecteurs / de Calibre.
"""

from fastapi.testclient import TestClient

from ferry_agent.main import app
from ferry_agent.services import converters


def test_health() -> None:
    with TestClient(app) as client:
        resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_healthz_exposes_conversion_capacity() -> None:
    with TestClient(app) as client:
        resp = client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "conversion" in body
    conversion = body["conversion"]
    assert set(conversion) == {"ebook_convert_available", "ebook_convert_version"}
    assert conversion["ebook_convert_available"] is converters.ebook_convert_available()
    if conversion["ebook_convert_available"]:
        assert conversion["ebook_convert_version"] is None or isinstance(
            conversion["ebook_convert_version"], str
        )
    else:
        assert conversion["ebook_convert_version"] is None
