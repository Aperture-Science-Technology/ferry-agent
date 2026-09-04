"""Tests pour la suppression definitive des accès gateway et des devices :
- DELETE /api/v1/gateways/{gateway_id}  (purge les GatewayJob lies)
- DELETE /api/v1/devices/{device_id}    (purge les DeliveryJob lies)

Toutes les routes sont scopees par user_id (404 si la ressource appartient a
un autre utilisateur), suivant le pattern deja utilise par api/books.py.
"""

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

from ferry_agent.api.deps import CurrentUser as CU, get_current_user
from ferry_agent.db import get_db
from ferry_agent.main import app
from ferry_agent.models import DeviceBrand, DeliveryTier, PairingStatus
from ferry_agent.services import devices as device_service
from ferry_agent.services import gateways as gateway_service

_NOW = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
_USER_ID = uuid.uuid4()
_USER_EMAIL = "test@example.com"


def _fake_gateway(**overrides):
    gw = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=_USER_ID,
        name="Maison",
        pairing_status=PairingStatus.paired,
        last_seen_at=_NOW,
    )
    for key, value in overrides.items():
        setattr(gw, key, value)
    return gw


def _fake_device(**overrides):
    device = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=_USER_ID,
        brand=DeviceBrand.kobo,
        model="Libra 2",
        delivery_tier=DeliveryTier.C,
        link_ref=None,
        last_synced_at=None,
    )
    for key, value in overrides.items():
        setattr(device, key, value)
    return device


def _override(fake_db):
    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = lambda: CU(id=_USER_ID, email=_USER_EMAIL)


class ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeSession:
    """Session minimale qui enregistre les statements executes, pour
    verifier que la purge des enfants precede bien le delete du parent."""

    def __init__(self, execute_values=()):
        self.execute_values = list(execute_values)
        self.commits = 0
        self.statements = []
        self.deleted = []

    async def execute(self, statement):
        self.statements.append(statement)
        value = self.execute_values.pop(0) if self.execute_values else None
        return ScalarResult(value)

    async def commit(self):
        self.commits += 1

    async def delete(self, value):
        self.deleted.append(value)


class TestDeleteGatewayService:
    async def test_purges_jobs_then_gateway(self) -> None:
        gateway = _fake_gateway()
        db = FakeSession()

        await gateway_service.delete_gateway(db, gateway)

        assert len(db.statements) == 1
        compiled = str(db.statements[0])
        assert "gateway_jobs" in compiled
        assert db.deleted == [gateway]
        assert db.commits == 1


class TestDeleteGatewayApi:
    def test_delete_returns_204(self):
        gateway = _fake_gateway()

        async def fake_db():
            db = AsyncMock()
            result = MagicMock(scalar_one_or_none=MagicMock(return_value=gateway))
            db.execute = AsyncMock(return_value=result)
            db.delete = AsyncMock()
            db.commit = AsyncMock()
            yield db

        _override(fake_db)
        try:
            with TestClient(app) as client:
                resp = client.delete(f"/api/v1/gateways/{gateway.id}")
            assert resp.status_code == 204
            assert resp.content == b""
        finally:
            app.dependency_overrides.clear()

    def test_404_for_other_users_gateway(self):
        async def fake_db():
            db = AsyncMock()
            result = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
            db.execute = AsyncMock(return_value=result)
            yield db

        _override(fake_db)
        try:
            with TestClient(app) as client:
                resp = client.delete(f"/api/v1/gateways/{uuid.uuid4()}")
            assert resp.status_code == 404
        finally:
            app.dependency_overrides.clear()

    def test_delete_removed_gateway_not_listable(self):
        gateway = _fake_gateway()
        remaining: list = []

        async def fake_db():
            db = AsyncMock()

            async def fake_execute(query):
                result = MagicMock()
                # Requetes du DELETE (select gateway, purge jobs) : gateway trouve.
                # Requete du GET (list) : ce qui reste (vide apres suppression).
                result.scalar_one_or_none = MagicMock(return_value=gateway if not remaining else None)
                result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=remaining)))
                return result

            db.execute = AsyncMock(side_effect=fake_execute)
            db.delete = AsyncMock()
            db.commit = AsyncMock()
            yield db

        _override(fake_db)
        try:
            with TestClient(app) as client:
                del_resp = client.delete(f"/api/v1/gateways/{gateway.id}")
                assert del_resp.status_code == 204
                list_resp = client.get("/api/v1/gateways")
                assert list_resp.status_code == 200
                assert list_resp.json() == []
        finally:
            app.dependency_overrides.clear()


class TestDeleteDeviceService:
    async def test_purges_delivery_jobs_then_device(self) -> None:
        device = _fake_device()
        db = FakeSession()

        await device_service.delete_device(db, device)

        assert len(db.statements) == 1
        compiled = str(db.statements[0])
        assert "delivery_jobs" in compiled
        assert db.deleted == [device]
        assert db.commits == 1


class TestDeleteDeviceApi:
    def test_delete_returns_204(self):
        device = _fake_device()

        async def fake_db():
            db = AsyncMock()
            result = MagicMock(scalar_one_or_none=MagicMock(return_value=device))
            db.execute = AsyncMock(return_value=result)
            db.delete = AsyncMock()
            db.commit = AsyncMock()
            yield db

        _override(fake_db)
        try:
            with TestClient(app) as client:
                resp = client.delete(f"/api/v1/devices/{device.id}")
            assert resp.status_code == 204
            assert resp.content == b""
        finally:
            app.dependency_overrides.clear()

    def test_404_for_other_users_device(self):
        async def fake_db():
            db = AsyncMock()
            result = MagicMock(scalar_one_or_none=MagicMock(return_value=None))
            db.execute = AsyncMock(return_value=result)
            yield db

        _override(fake_db)
        try:
            with TestClient(app) as client:
                resp = client.delete(f"/api/v1/devices/{uuid.uuid4()}")
            assert resp.status_code == 404
        finally:
            app.dependency_overrides.clear()

    def test_delete_removed_device_not_listable(self):
        device = _fake_device()
        remaining: list = []

        async def fake_db():
            db = AsyncMock()

            async def fake_execute(query):
                result = MagicMock()
                result.scalar_one_or_none = MagicMock(return_value=device if not remaining else None)
                result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=remaining)))
                return result

            db.execute = AsyncMock(side_effect=fake_execute)
            db.delete = AsyncMock()
            db.commit = AsyncMock()
            yield db

        _override(fake_db)
        try:
            with TestClient(app) as client:
                del_resp = client.delete(f"/api/v1/devices/{device.id}")
                assert del_resp.status_code == 204
                list_resp = client.get("/api/v1/devices")
                assert list_resp.status_code == 200
                assert list_resp.json() == []
        finally:
            app.dependency_overrides.clear()
