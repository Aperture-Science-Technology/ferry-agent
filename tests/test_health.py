"""Tests des routes de sante publiques.

Ces routes ne doivent necessiter ni base de donnees ni Calibre : le
`TestClient` declenche le lifespan de l'app (cf. `main.py`), qui se limite a
creer un moteur SQLAlchemy (sans se connecter) et logguer l'etat des
connecteurs / de Calibre.
"""

from fastapi.testclient import TestClient

from ferry_agent.main import app


def test_health() -> None:
    with TestClient(app) as client:
        resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_healthz() -> None:
    with TestClient(app) as client:
        resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
