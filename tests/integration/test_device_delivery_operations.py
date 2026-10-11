"""Real PostgreSQL regressions for delivery operations, quotas and health."""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select, text

from ferry_agent.api.deps import get_current_user
from ferry_agent.main import app
from ferry_agent.models import DeliveryJob, DeliveryMethod, DeliveryStatus, Device, LibraryItem, User
from ferry_agent.services import mailer
from ferry_agent.config import get_settings


async def seed(client, db, *, brand="pocketbook", name="Liseuse été"):
    device = (await client.post("/api/v1/devices", json={"brand": brand, "name": name})).json()
    owner = app.dependency_overrides[get_current_user]().id
    item = LibraryItem(
        user_id=owner, title="Éléphant", author="Auteur", original_format="epub", storage_path="/unused", size_bytes=128
    )
    db.add(item)
    await db.commit()
    return device, item


async def test_filters_pagination_ownership_and_cancel(client, db_session):
    device, item = await seed(client, db_session)
    jobs = [
        DeliveryJob(
            device_id=uuid.UUID(device["id"]),
            library_item_id=item.id,
            method=DeliveryMethod.opds,
            created_at=datetime.now(timezone.utc) - timedelta(minutes=i),
        )
        for i in range(3)
    ]
    db_session.add_all(jobs)
    await db_session.commit()
    response = await client.get(
        "/api/v1/deliveries",
        params={"q": "ELEPHANT", "limit": 1, "page": 2, "status": "queued", "device_id": device["id"]},
    )
    assert response.status_code == 200
    assert [row["id"] for row in response.json()] == [str(jobs[1].id)]
    assert len((await client.get("/api/v1/deliveries?q=ETE")).json()) == 3
    assert (await client.get("/api/v1/deliveries?q=%25")).json() == []
    assert (await client.get("/api/v1/deliveries?page=0")).status_code == 422
    response = await client.post(f"/api/v1/deliveries/{jobs[0].id}/cancel")
    assert response.json()["status"] == "failed"
    assert response.json()["error"] == "annulé par l'utilisateur"
    assert (await client.post(f"/api/v1/deliveries/{jobs[0].id}/cancel")).status_code == 409
    assert (await client.post(f"/api/v1/deliveries/{jobs[1].id}/retry")).status_code == 409
    original = app.dependency_overrides[get_current_user]
    other = User(email="outsider@example.test")
    db_session.add(other)
    await db_session.commit()
    from ferry_agent.api.deps import CurrentUser

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=other.id, email=other.email)
    try:
        assert (await client.get("/api/v1/deliveries")).json() == []
        for action in ("retry", "cancel"):
            assert (await client.post(f"/api/v1/deliveries/{jobs[0].id}/{action}")).status_code == 404
    finally:
        app.dependency_overrides[get_current_user] = original


async def test_health_is_scoped_and_has_no_internal_addresses(client, db_session, monkeypatch):
    await seed(client, db_session)
    monkeypatch.setattr(mailer, "is_configured", lambda: False)
    response = await client.get("/api/v1/system/health")
    assert response.status_code == 200
    data = response.json()
    assert data["storage"]["used_bytes"] == 128
    assert data["library"]["items"] == 1
    assert data["mail"]["configured"] is False
    assert data["gateways"] == {"total": 0, "online": 0, "pending": 0, "revoked": 0}
    assert "smtp_host" not in response.text and "password" not in response.text


@pytest.mark.parametrize("case,expected", [("ok", 200), ("domain", 400), ("smtp", 503), ("quota", 429)])
async def test_kindle_test_policy(client, db_session, monkeypatch, case, expected):
    owner = app.dependency_overrides[get_current_user]().id
    profile = (await db_session.execute(select(User).where(User.id == owner))).scalar_one()
    profile.kindle_email = "reader@gmail.com" if case == "domain" else "reader@kindle.com"
    await db_session.commit()
    monkeypatch.setattr(mailer, "is_configured", lambda: case != "smtp")
    send = AsyncMock()
    monkeypatch.setattr(mailer, "send_test", send)
    monkeypatch.setenv("EMAIL_SEND_HOURLY_QUOTA", "1")
    get_settings.cache_clear()
    if case == "quota":
        profile.mail_test_sends = [datetime.now(timezone.utc).isoformat()]
        await db_session.commit()
    try:
        response = await client.post("/api/v1/mail/test", json={"device_id": None})
        assert response.status_code == expected, response.text
        if case == "ok":
            assert response.json() == {"status": "sent", "recipient": "reader@kindle.com"}
            assert (await client.post("/api/v1/mail/test", json={})).status_code == 429
            send.assert_awaited_once_with("reader@kindle.com")
        else:
            send.assert_not_awaited()
    finally:
        get_settings.cache_clear()


async def test_retry_deleted_book_is_actionable(client, db_session):
    device, _ = await seed(client, db_session)
    job = DeliveryJob(device_id=uuid.UUID(device["id"]), method=DeliveryMethod.opds, status=DeliveryStatus.failed)
    db_session.add(job)
    await db_session.commit()
    response = await client.post(f"/api/v1/deliveries/{job.id}/retry")
    assert response.status_code == 409
    assert "supprimé" in response.json()["detail"]


async def test_enum_and_unaccent_exist(db_session):
    assert (await db_session.execute(text("SELECT unaccent('Été')"))).scalar_one() == "Ete"
    assert (await db_session.execute(text("SELECT 'opds'::delivery_method"))).scalar_one() == "opds"


async def test_opds_reuses_encrypted_token_retry_and_revocation(client, db_session, monkeypatch):
    from cryptography.fernet import Fernet
    from ferry_agent.models import OpdsToken

    monkeypatch.setenv("FERNET_KEY", Fernet.generate_key().decode())
    get_settings.cache_clear()
    try:
        device, item = await seed(client, db_session)
        payload = {"device_id": device["id"], "library_item_id": str(item.id), "method": "opds"}
        first = await client.post("/api/v1/deliveries", json=payload)
        assert first.status_code == 201, first.text
        assert first.json()["status"] == "sent", first.text
        assert first.json()["terminal"] is True
        url = first.json()["download_url"]
        second = await client.post("/api/v1/deliveries", json=payload)
        assert second.json()["download_url"] == url
        owner = app.dependency_overrides[get_current_user]().id
        tokens = (await db_session.execute(select(OpdsToken).where(OpdsToken.user_id == owner))).scalars().all()
        assert len(tokens) == 1
        token = tokens[0]
        assert token.label == device["name"]
        assert url.rsplit("/", 1)[-1] not in token.token_encrypted
        assert token.token_hash not in first.text
        detail = (await client.get(f"/api/v1/deliveries/{first.json()['id']}")).json()
        assert detail["download_url"] == url
        job = await db_session.get(DeliveryJob, uuid.UUID(first.json()["id"]))
        job.status = DeliveryStatus.failed
        job.attempts = 3
        job.error = "failed before"
        await db_session.commit()
        retry = await client.post(f"/api/v1/deliveries/{job.id}/retry")
        assert retry.status_code == 200
        assert retry.json()["status"] == "sent"
        assert retry.json()["download_url"] == url
        assert retry.json()["error"] is None
        await db_session.refresh(job)
        assert job.attempts == 0
        token.revoked_at = datetime.now(timezone.utc)
        await db_session.commit()
        assert (await client.get(f"/api/v1/deliveries/{job.id}")).json()["download_url"] is None
        third = (await client.post("/api/v1/deliveries", json=payload)).json()
        assert third["download_url"] != url
    finally:
        get_settings.cache_clear()


async def test_legacy_opds_label_does_not_duplicate_or_rotate_access(client, db_session, monkeypatch):
    from cryptography.fernet import Fernet
    from ferry_agent.api.deps import hash_secret
    from ferry_agent.models import OpdsToken

    monkeypatch.setenv("FERNET_KEY", Fernet.generate_key().decode())
    get_settings.cache_clear()
    try:
        device, item = await seed(client, db_session)
        token = OpdsToken(user_id=item.user_id, label=device["name"], token_hash=hash_secret("legacy-secret"))
        db_session.add(token)
        await db_session.commit()
        response = await client.post(
            "/api/v1/deliveries", json={"device_id": device["id"], "library_item_id": str(item.id), "method": "opds"}
        )
        assert response.json()["status"] == "failed"
        assert "Révoquez" in response.json()["error"]
        assert (
            len((await db_session.execute(select(OpdsToken).where(OpdsToken.user_id == item.user_id))).scalars().all())
            == 1
        )
        await db_session.refresh(token)
        assert token.revoked_at is None
    finally:
        get_settings.cache_clear()


async def test_running_delivery_cannot_be_cancelled_and_cancelled_job_never_runs(client, db_session, monkeypatch):
    import asyncio
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from ferry_agent.services import delivery

    device, item = await seed(client, db_session, brand="kindle")
    job = DeliveryJob(device_id=uuid.UUID(device["id"]), library_item_id=item.id, method=DeliveryMethod.email)
    db_session.add(job)
    await db_session.commit()
    entered, finish = asyncio.Event(), asyncio.Event()

    async def sending(db, active_job, *args):
        entered.set()
        await finish.wait()
        active_job.status = DeliveryStatus.sent
        await db.commit()

    monkeypatch.setattr(delivery, "engine", db_session.bind)
    monkeypatch.setattr(delivery, "async_session_factory", async_sessionmaker(db_session.bind, expire_on_commit=False))
    monkeypatch.setattr(delivery, "_deliver_tier_a", sending)
    task = asyncio.create_task(delivery.run_delivery(job.id))
    try:
        await asyncio.wait_for(entered.wait(), timeout=5)
        response = await client.post(f"/api/v1/deliveries/{job.id}/cancel")
        assert response.status_code == 409
    finally:
        finish.set()
        await asyncio.wait_for(task, timeout=5)
    await db_session.refresh(job)
    assert job.status == DeliveryStatus.sent
    job.status = DeliveryStatus.queued
    await db_session.commit()
    assert (await client.post(f"/api/v1/deliveries/{job.id}/cancel")).status_code == 200
    entered.clear()
    await delivery.run_delivery(job.id)
    assert not entered.is_set()
    await db_session.refresh(job)
    assert job.status == DeliveryStatus.failed


async def test_device_test_address_wins_and_foreign_device_is_hidden(client, db_session, monkeypatch):
    device, _ = await seed(client, db_session, brand="kindle")
    row = await db_session.get(Device, uuid.UUID(device["id"]))
    row.email_address = "device@kindle.fr"
    await db_session.commit()
    monkeypatch.setattr(mailer, "is_configured", lambda: True)
    send = AsyncMock()
    monkeypatch.setattr(mailer, "send_test", send)
    response = await client.post("/api/v1/mail/test", json={"device_id": device["id"]})
    assert response.json()["recipient"] == "device@kindle.fr"
    response = await client.post("/api/v1/mail/test", json={"device_id": str(uuid.uuid4())})
    assert response.status_code == 404
    send.assert_awaited_once_with("device@kindle.fr")


def test_device_delivery_migration_is_replayable(fresh_db_url, alembic_run):
    alembic_run(fresh_db_url, "head")
    alembic_run(fresh_db_url, "0018_users_clerk_sub", direction="downgrade")
    alembic_run(fresh_db_url, "head")


async def test_concurrent_catalog_creation_keeps_one_token(client, db_session, monkeypatch):
    import asyncio
    from cryptography.fernet import Fernet
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from ferry_agent.models import OpdsToken
    from ferry_agent.services import opds

    monkeypatch.setenv("FERNET_KEY", Fernet.generate_key().decode())
    get_settings.cache_clear()
    owner = app.dependency_overrides[get_current_user]().id
    factory = async_sessionmaker(db_session.bind, expire_on_commit=False)

    async def get_link():
        async with factory() as db:
            token, url = await opds.device_catalog(db, owner, "Concurrent reader")
            await db.commit()
            return token.id, url

    try:
        first, second = await asyncio.gather(get_link(), get_link())
        assert first == second
        tokens = (await db_session.execute(select(OpdsToken).where(OpdsToken.user_id == owner))).scalars().all()
        assert len(tokens) == 1
    finally:
        get_settings.cache_clear()


async def test_system_counts_online_window_and_recent_deliveries(client, db_session):
    from ferry_agent.models import Gateway, PairingStatus

    device, item = await seed(client, db_session)
    now = datetime.now(timezone.utc)
    db_session.add_all(
        [
            Gateway(user_id=item.user_id, name="online", pairing_status=PairingStatus.paired, last_seen_at=now),
            Gateway(
                user_id=item.user_id,
                name="offline",
                pairing_status=PairingStatus.paired,
                last_seen_at=now - timedelta(days=1),
            ),
            Gateway(user_id=item.user_id, name="pending", pairing_status=PairingStatus.pending, last_seen_at=now),
            Gateway(user_id=item.user_id, name="revoked", pairing_status=PairingStatus.revoked, last_seen_at=now),
            DeliveryJob(device_id=uuid.UUID(device["id"]), method=DeliveryMethod.opds, status=DeliveryStatus.sent),
            DeliveryJob(
                device_id=uuid.UUID(device["id"]),
                method=DeliveryMethod.opds,
                status=DeliveryStatus.failed,
                created_at=now - timedelta(days=8),
            ),
        ]
    )
    outsider = User(email="health-outsider@example.test")
    db_session.add(outsider)
    await db_session.flush()
    db_session.add(Gateway(user_id=outsider.id, name="other", pairing_status=PairingStatus.paired, last_seen_at=now))
    await db_session.commit()
    data = (await client.get("/api/v1/system/health")).json()
    assert data["gateways"] == {"total": 4, "online": 1, "pending": 1, "revoked": 1}
    assert data["library"]["deliveries_last_7_days"] == {"queued": 0, "sent": 1, "delivered": 0, "failed": 0}
