"""Recreate gateway credentials against real Postgres (FA-FUNC-GATEWAY-01)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ferry_agent.api.deps import hash_secret
from ferry_agent.models import Gateway, PairingStatus, User
from ferry_agent.services.gateways import recreate_gateway_credentials


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def test_recreate_expired_pending_persists_new_hashes(db_session) -> None:
    user = User(email=f"recreate-{_utcnow().timestamp()}@example.test")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    gateway = Gateway(
        user_id=user.id,
        name="expired-home",
        pairing_status=PairingStatus.pending,
        api_key_hash=hash_secret("old-key"),
        pairing_token_hash=hash_secret("old-token"),
        pairing_expires_at=_utcnow() - timedelta(minutes=30),
        pairing_used=False,
    )
    db_session.add(gateway)
    await db_session.commit()
    await db_session.refresh(gateway)
    gateway_id = gateway.id
    old_api = gateway.api_key_hash
    old_token = gateway.pairing_token_hash

    updated, pairing_token, gateway_key = await recreate_gateway_credentials(
        db_session, gateway, ttl_minutes=15
    )

    assert updated.id == gateway_id
    assert pairing_token and gateway_key
    assert updated.api_key_hash == hash_secret(gateway_key)
    assert updated.pairing_token_hash == hash_secret(pairing_token)
    assert updated.api_key_hash != old_api
    assert updated.pairing_token_hash != old_token
    assert updated.pairing_status == PairingStatus.pending
    assert updated.pairing_used is False
    assert updated.pairing_expires_at is not None
    assert updated.pairing_expires_at > _utcnow()

    db_session.expire_all()
    reloaded = await db_session.get(Gateway, gateway_id)
    assert reloaded is not None
    assert reloaded.api_key_hash == hash_secret(gateway_key)
    assert reloaded.pairing_token_hash == hash_secret(pairing_token)
