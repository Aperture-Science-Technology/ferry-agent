"""W-17 : dead-letter, backoff et reprise prioritaire sur GatewayJob."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from ferry_agent.models import (
    Gateway,
    GatewayJob,
    GatewayJobStatus,
    GatewayJobType,
    PairingStatus,
    User,
)
from ferry_agent.services.gateways import poll_job


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _patch_poll_settings(monkeypatch, *, max_attempts: int = 5, backoff_base: int = 0) -> None:
    monkeypatch.setattr(
        "ferry_agent.services.gateways.get_settings",
        lambda: SimpleNamespace(
            gateway_job_max_attempts=max_attempts,
            gateway_job_backoff_base_seconds=backoff_base,
        ),
    )


async def _seed_gateway(db_session) -> Gateway:
    user = User(email=f"w17-{_utcnow().timestamp()}@example.test")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    gateway = Gateway(
        user_id=user.id,
        name="gw-w17",
        pairing_status=PairingStatus.paired,
        pairing_used=True,
    )
    db_session.add(gateway)
    await db_session.commit()
    await db_session.refresh(gateway)
    return gateway


async def test_poison_fetch_dead_letters_and_unblocks_queue(db_session, monkeypatch) -> None:
    """Fetch repris jusqu'a dead-letter : le search derriere est servi (file debloquee)."""
    _patch_poll_settings(monkeypatch, max_attempts=5, backoff_base=0)
    gateway = await _seed_gateway(db_session)
    gateway_id = gateway.id

    now = _utcnow()
    fetch = GatewayJob(
        gateway_id=gateway_id,
        type=GatewayJobType.fetch,
        payload={"magnet": "magnet:?xt=urn:btih:dead"},
        status=GatewayJobStatus.pending,
        created_at=now - timedelta(seconds=10),
        updated_at=now - timedelta(seconds=10),
    )
    search = GatewayJob(
        gateway_id=gateway_id,
        type=GatewayJobType.search,
        payload={"query": "Dune"},
        status=GatewayJobStatus.pending,
        created_at=now,
        updated_at=now,
    )
    db_session.add_all([fetch, search])
    await db_session.commit()
    await db_session.refresh(fetch)
    await db_session.refresh(search)
    fetch_id = fetch.id
    search_id = search.id

    # 5 reprises renvoient le fetch poison (attempts 1..5).
    for expected_attempts in range(1, 6):
        job = await poll_job(db_session, gateway_id)
        assert job is not None
        assert job.id == fetch_id
        assert job.attempts == expected_attempts
        assert job.status == GatewayJobStatus.running

    # 6e poll : attempts=6 → dead-letter ; re-selection → search (file debloquee).
    sixth = await poll_job(db_session, gateway_id)
    assert sixth is not None
    assert sixth.id == search_id
    assert sixth.type == GatewayJobType.search
    assert sixth.status == GatewayJobStatus.running

    db_session.expire_all()
    abandoned = await db_session.get(GatewayJob, fetch_id)
    assert abandoned is not None
    assert abandoned.status == GatewayJobStatus.failed
    assert abandoned.attempts == 6
    assert abandoned.result_ref == "abandonné après 6 tentatives"

    # 7e poll : le search reste le job actif (file toujours debloquee).
    seventh = await poll_job(db_session, gateway_id)
    assert seventh is not None
    assert seventh.id == search_id
    assert seventh.attempts == 2


async def test_backoff_skips_job_until_next_attempt_at(db_session, monkeypatch) -> None:
    """Un job en backoff n'est pas renvoye avant l'echeance de next_attempt_at."""
    _patch_poll_settings(monkeypatch, max_attempts=5, backoff_base=30)
    gateway = await _seed_gateway(db_session)

    job = GatewayJob(
        gateway_id=gateway.id,
        type=GatewayJobType.fetch,
        payload={"magnet": "magnet:?xt=urn:btih:backoff"},
        status=GatewayJobStatus.pending,
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)

    first = await poll_job(db_session, gateway.id)
    assert first is not None
    assert first.id == job.id
    assert first.attempts == 1
    assert first.next_attempt_at is not None
    assert first.next_attempt_at > _utcnow()

    assert await poll_job(db_session, gateway.id) is None

    first.next_attempt_at = _utcnow() - timedelta(seconds=1)
    await db_session.commit()

    second = await poll_job(db_session, gateway.id)
    assert second is not None
    assert second.id == job.id
    assert second.attempts == 2


async def test_running_job_resumed_preferentially_after_crash(db_session, monkeypatch) -> None:
    """Un running (attempts=1) eligible est repris avant un pending plus ancien."""
    _patch_poll_settings(monkeypatch, max_attempts=5, backoff_base=30)
    gateway = await _seed_gateway(db_session)

    now = _utcnow()
    pending = GatewayJob(
        gateway_id=gateway.id,
        type=GatewayJobType.search,
        payload={"query": "older-pending"},
        status=GatewayJobStatus.pending,
        created_at=now - timedelta(minutes=5),
        updated_at=now - timedelta(minutes=5),
    )
    running = GatewayJob(
        gateway_id=gateway.id,
        type=GatewayJobType.fetch,
        payload={"magnet": "magnet:?xt=urn:btih:crash"},
        status=GatewayJobStatus.running,
        attempts=1,
        next_attempt_at=None,
        created_at=now - timedelta(minutes=1),
        updated_at=now - timedelta(minutes=1),
    )
    db_session.add_all([pending, running])
    await db_session.commit()
    await db_session.refresh(pending)
    await db_session.refresh(running)

    resumed = await poll_job(db_session, gateway.id)
    assert resumed is not None
    assert resumed.id == running.id
    assert resumed.status == GatewayJobStatus.running
    assert resumed.attempts == 2
