"""W-06 : purge des GatewayJob termines (retention)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from ferry_agent.models import (
    Gateway,
    GatewayJob,
    GatewayJobStatus,
    GatewayJobType,
    PairingStatus,
    User,
)
from ferry_agent.services.gateways import purge_finished_jobs


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def test_purge_finished_jobs_keeps_recent_and_running(db_session) -> None:
    """3 done anciens purges ; 2 done recents + 1 running ancien conserves."""
    user = User(email="purge-w06@example.test")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    gateway = Gateway(
        user_id=user.id,
        name="gw-purge",
        pairing_status=PairingStatus.paired,
        pairing_used=True,
    )
    db_session.add(gateway)
    await db_session.commit()
    await db_session.refresh(gateway)

    now = _utcnow()
    ten_days_ago = now - timedelta(days=10)
    thirty_days_ago = now - timedelta(days=30)

    jobs = [
        GatewayJob(
            gateway_id=gateway.id,
            type=GatewayJobType.search,
            payload={"query": f"old-done-{i}"},
            status=GatewayJobStatus.done,
            created_at=ten_days_ago,
            updated_at=ten_days_ago,
        )
        for i in range(3)
    ]
    jobs.extend(
        GatewayJob(
            gateway_id=gateway.id,
            type=GatewayJobType.search,
            payload={"query": f"fresh-done-{i}"},
            status=GatewayJobStatus.done,
            created_at=now,
            updated_at=now,
        )
        for i in range(2)
    )
    jobs.append(
        GatewayJob(
            gateway_id=gateway.id,
            type=GatewayJobType.search,
            payload={"query": "old-running"},
            status=GatewayJobStatus.running,
            created_at=thirty_days_ago,
            updated_at=thirty_days_ago,
        )
    )
    db_session.add_all(jobs)
    await db_session.commit()

    deleted = await purge_finished_jobs(db_session, retention_days=7)
    assert deleted == 3

    db_session.expire_all()
    remaining = await db_session.execute(select(func.count()).select_from(GatewayJob))
    assert remaining.scalar_one() == 3

    statuses = (
        await db_session.execute(select(GatewayJob.status).order_by(GatewayJob.status))
    ).scalars().all()
    assert statuses.count(GatewayJobStatus.done) == 2
    assert statuses.count(GatewayJobStatus.running) == 1
