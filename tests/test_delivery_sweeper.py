"""Tests du balayeur de jobs de livraison bloques en ``queued``."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from ferry_agent.models import DeliveryJob, DeliveryMethod, DeliveryStatus
from ferry_agent.services.delivery_sweeper import reap_stuck_jobs
from tests.fakes import FakeSession


def _make_job(**overrides) -> DeliveryJob:
    values = {
        "id": uuid.uuid4(),
        "library_item_id": uuid.uuid4(),
        "device_id": uuid.uuid4(),
        "status": DeliveryStatus.queued,
        "method": DeliveryMethod.email,
        "created_at": datetime.now(timezone.utc),
    }
    values.update(overrides)
    return DeliveryJob(**values)


async def test_reap_stuck_jobs_marks_old_queued_as_failed() -> None:
    old = datetime.now(timezone.utc) - timedelta(minutes=30)
    job = _make_job(created_at=old, status=DeliveryStatus.queued)
    db = FakeSession([[job]])

    count = await reap_stuck_jobs(db, stuck_after_minutes=15)

    assert count == 1
    assert job.status == DeliveryStatus.failed
    assert job.error == ("Livraison interrompue avant envoi (service redémarré). Relancez la livraison.")
    assert db.commits == 1


async def test_reap_stuck_jobs_leaves_recent_queued_intact() -> None:
    recent = datetime.now(timezone.utc) - timedelta(minutes=2)
    job = _make_job(created_at=recent, status=DeliveryStatus.queued)
    # FakeSession n'applique pas le WHERE : on simule le filtre SQL (rien ne matche).
    db = FakeSession([[]])

    count = await reap_stuck_jobs(db, stuck_after_minutes=15)

    assert count == 0
    assert job.status == DeliveryStatus.queued
    assert job.error is None
    assert db.commits == 0


async def test_reap_stuck_jobs_never_touches_sent() -> None:
    old = datetime.now(timezone.utc) - timedelta(minutes=60)
    sent_job = _make_job(created_at=old, status=DeliveryStatus.sent)
    # Le SELECT ne retourne que les queued : un sent ancien n'apparait pas.
    db = FakeSession([[]])

    count = await reap_stuck_jobs(db, stuck_after_minutes=15)

    assert count == 0
    assert sent_job.status == DeliveryStatus.sent
    assert sent_job.error is None
