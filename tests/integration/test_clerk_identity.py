"""FA-IDENTITY-SUB-01 : identite, rattachements et migration sur Postgres reel."""

import asyncio
import base64
import time
import uuid
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519, rsa
from httpx import ASGITransport, AsyncClient
from sqlalchemy import UniqueConstraint, create_engine, func, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from ferry_agent.api import deps
from ferry_agent.db import get_db
from ferry_agent.main import app
from ferry_agent.models import DeliveryTier, Device, DeviceBrand, Gateway, LibraryItem, Source, User
from ferry_agent.services.sources import DEFAULT_SOURCE_TYPES


def _sub():
    return f"user_{uuid.uuid4().hex}"


def _pem_pair(key):
    return (
        key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()),
        key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo),
    )


async def test_web_then_mcp_same_user_id(monkeypatch, db_session):
    """Deux vraies requetes HTTP, sessions Clerk simulees et signature Ed25519."""
    private, public = _pem_pair(rsa.generate_private_key(public_exponent=65537, key_size=2048))
    mcp_private, mcp_public = _pem_pair(ed25519.Ed25519PrivateKey.generate())
    monkeypatch.setattr(
        deps,
        "get_settings",
        lambda: SimpleNamespace(
            clerk_issuer="https://clerk.example.test",
            clerk_audience="",
            mcp_assertion_public_key_b64=base64.b64encode(mcp_public).decode(),
        ),
    )
    monkeypatch.setattr(
        app.state,
        "jwks_client",
        SimpleNamespace(get_signing_key_from_jwt=lambda token: SimpleNamespace(key=public)),
        raising=False,
    )
    subject = _sub()
    now = int(time.time())
    common = {"sub": subject, "iat": now, "exp": now + 120}
    web = jwt.encode({**common, "iss": "https://clerk.example.test"}, private, algorithm="RS256")
    mcp = jwt.encode(
        {**common, "iss": "ferry-agent-mcp", "aud": "ferry-core", "email": f"{subject}@example.test"},
        mcp_private,
        algorithm="EdDSA",
    )

    async def database():
        yield db_session

    app.dependency_overrides[get_db] = database
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            first = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {web}"})
            second = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {mcp}"})
        assert first.status_code == second.status_code == 200
        assert first.json()["id"] == second.json()["id"]
        assert second.json()["email"] == f"{subject}@example.test"
        print(
            f"web={first.status_code} id={first.json()['id']}; "
            f"MCP={second.status_code} id={second.json()['id']}; email={second.json()['email']}"
        )
    finally:
        app.dependency_overrides.pop(get_db, None)


async def test_adoption_preserves_all_attachments_and_persists(db_session):
    subject = _sub()
    user = User(email=subject)
    db_session.add(user)
    await db_session.flush()
    device = Device(user_id=user.id, brand=DeviceBrand.kindle, delivery_tier=DeliveryTier.A)
    gateway = Gateway(user_id=user.id, name="Maison")
    item = LibraryItem(user_id=user.id, title="Livre", storage_path="/tmp/identity.epub", original_format="epub")
    db_session.add_all([device, gateway, item])
    await db_session.commit()
    ids = user.id, device.id, gateway.id, item.id
    resolved = await deps._get_or_create_clerk_user(db_session, subject, "adoption@example.test")
    assert resolved.id == ids[0]
    # Un rollback apres resolution prouve que l'adoption a ete COMMITTEE.
    await db_session.rollback()
    db_session.expunge_all()
    persisted = await db_session.get(User, ids[0])
    assert persisted.clerk_sub == subject
    assert persisted.email == "adoption@example.test"
    for model, identifier in zip((Device, Gateway, LibraryItem), ids[1:], strict=True):
        assert (await db_session.get(model, identifier)).user_id == ids[0]
    print(f"adoption: user.id={ids[0]} conserve; liseuse={ids[1]}; gateway={ids[2]}; livre={ids[3]}")


async def test_bound_sub_wins_over_legacy_email(db_session):
    subject = _sub()
    bound = User(clerk_sub=subject, email=f"{subject}@example.test")
    legacy = User(email=subject)
    db_session.add_all([bound, legacy])
    await db_session.commit()
    resolved = await deps._get_or_create_clerk_user(db_session, subject)
    assert resolved.id == bound.id
    assert legacy.clerk_sub is None
    assert legacy.id != resolved.id
    print("non-fusion: clerk_sub prioritaire; ligne email==sub conservee et non adoptee")


async def test_legacy_email_bound_to_other_sub_is_never_adopted(db_session):
    subject = _sub()
    other = User(clerk_sub=_sub(), email=subject)
    db_session.add(other)
    await db_session.commit()
    previous_sub = other.clerk_sub
    resolved = await deps._get_or_create_clerk_user(db_session, subject, f"{subject}@example.test")
    assert resolved.id != other.id
    assert other.clerk_sub == previous_sub
    assert other.email == subject
    print("non-fusion: ligne liee a un autre sub intacte; compte distinct cree")


async def test_unknown_sub_provisions_default_sources(db_session):
    subject = _sub()
    user = await deps._get_or_create_clerk_user(db_session, subject)
    sources = (await db_session.scalars(select(Source.type).where(Source.user_id == user.id))).all()
    assert set(sources) == set(DEFAULT_SOURCE_TYPES)
    assert len(sources) == 3
    assert user.email == subject
    again = await deps._get_or_create_clerk_user(db_session, subject)
    assert again.id == user.id
    print(f"nouveau sub: {user.id}; sources={sorted(s.value for s in sources)}")


async def test_email_only_existing_account_is_not_adopted(db_session):
    subject = _sub()
    old = User(email=f"{subject}@example.test")
    db_session.add(old)
    await db_session.commit()
    # Sans email fourni, le sub inedit ne doit jamais retrouver l'ancien compte email.
    resolved = await deps._get_or_create_clerk_user(db_session, subject)
    assert resolved.id != old.id
    assert old.clerk_sub is None


async def test_existing_readable_email_is_not_overwritten(db_session):
    subject = _sub()
    user = User(clerk_sub=subject, email=f"{subject}@example.test")
    db_session.add(user)
    await db_session.commit()
    await deps._get_or_create_clerk_user(db_session, subject, "other@example.test")
    assert user.email == f"{subject}@example.test"


async def test_production_email_collision_keeps_both_accounts_and_readable_email(db_session):
    """Cas exact du brief : compte Clerk equipe et ancien compte MCP par email."""
    subject = _sub()
    email = f"collision-{uuid.uuid4().hex}@example.test"
    owner = User(clerk_sub=subject, email=subject)
    old_mcp = User(email=email)
    db_session.add_all([owner, old_mcp])
    await db_session.commit()
    owner_id, old_id = owner.id, old_mcp.id

    resolved = await deps._get_or_create_clerk_user(db_session, subject, email)
    assert resolved.id == owner_id
    assert resolved.email == email
    assert (await db_session.get(User, old_id)).email == email
    assert (await db_session.get(User, old_id)).clerk_sub is None
    assert old_id != resolved.id
    print("collision production: email lisible pose; deux comptes conserves; aucun rattachement transfere")


async def test_shared_email_resolves_each_sub_to_its_own_account(db_session):
    email = f"shared-{uuid.uuid4().hex}@example.test"
    first_sub, second_sub = _sub(), _sub()
    first = await deps._get_or_create_clerk_user(db_session, first_sub, email)
    second = await deps._get_or_create_clerk_user(db_session, second_sub, email)
    assert first.id != second.id
    for subject, expected in ((second_sub, second.id), (first_sub, first.id)):
        resolved = await deps._get_or_create_clerk_user(db_session, subject, email)
        assert resolved.id == expected
        assert resolved.email == email
    assert await db_session.scalar(select(func.count()).select_from(User).where(User.email == email)) == 2
    print("email partage: deux comptes distincts; chaque sub retrouve sa propre ligne")


async def test_dev_email_duplicates_choose_same_user_deterministically(db_session, monkeypatch):
    email = f"dev-{uuid.uuid4().hex}@example.test"
    ids = sorted([uuid.uuid4(), uuid.uuid4()])
    # Insertion dans l'ordre inverse du choix attendu.
    db_session.add_all([User(id=identifier, email=email) for identifier in reversed(ids)])
    await db_session.commit()
    monkeypatch.setattr(deps, "get_settings", lambda: SimpleNamespace(clerk_issuer=""))
    request = SimpleNamespace(app=app)
    for _ in range(2):
        current = await deps.get_current_user(request, authorization=None, x_dev_user=email, db=db_session)
        assert current.id == ids[0]
    assert await db_session.scalar(select(func.count()).select_from(User).where(User.email == email)) == 2
    print("X-Dev-User: deux emails identiques; meme UUID minimal choisi; deux lignes conservees")


async def test_legacy_email_duplicates_adopt_only_one_deterministic_user(db_session):
    subject = _sub()
    ids = sorted([uuid.uuid4(), uuid.uuid4()])
    db_session.add_all([User(id=identifier, email=subject) for identifier in reversed(ids)])
    await db_session.commit()
    resolved = await deps._get_or_create_clerk_user(db_session, subject)
    assert resolved.id == ids[0]
    assert resolved.clerk_sub == subject
    untouched = await db_session.get(User, ids[1])
    assert untouched.email == subject
    assert untouched.clerk_sub is None
    assert (await deps._get_or_create_clerk_user(db_session, subject)).id == ids[0]
    print("adoption avec doublons: UUID minimal adopte; autre ligne intacte")


def test_model_email_is_not_unique():
    table = User.__table__
    assert not table.c.email.unique
    assert not any(isinstance(c, UniqueConstraint) and list(c.columns.keys()) == ["email"] for c in table.constraints)
    email_index = next(index for index in table.indexes if index.name == "ix_users_email")
    assert list(email_index.columns.keys()) == ["email"]
    assert not email_index.unique
    print("modele: email sans UNIQUE; ix_users_email non unique")


async def test_concurrent_first_resolution_has_one_user_and_three_sources(migrated_db):
    engine = create_async_engine(migrated_db)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    subject = _sub()

    async def resolve():
        async with sessions() as db:
            user = await deps._get_or_create_clerk_user(db, subject)
            return user.id

    try:
        ids = await asyncio.gather(resolve(), resolve())
        assert ids[0] == ids[1]
        async with sessions() as db:
            assert await db.scalar(select(func.count()).select_from(User).where(User.clerk_sub == subject)) == 1
            assert await db.scalar(select(func.count()).select_from(Source).where(Source.user_id == ids[0])) == 3
        print(f"concurrence: deux resolutions, une ligne {ids[0]}, trois sources")
    finally:
        await engine.dispose()


@pytest.mark.parametrize("duplicate_email", [False, True])
def test_migration_backfill_unique_null_and_downgrade(fresh_db_url, alembic_run, to_sync_url, duplicate_email):
    alembic_run(fresh_db_url, "0017_device_email_address")
    engine = create_engine(to_sync_url(fresh_db_url))
    try:
        with engine.begin() as conn:
            for email in ("user_abc", "reader@example.test", "other@example.test"):
                conn.execute(
                    text(
                        "INSERT INTO users (id, email, created_at, default_format) VALUES (:id, :email, now(), 'epub')"
                    ),
                    {"id": uuid.uuid4(), "email": email},
                )
            before = conn.execute(text("SELECT * FROM users ORDER BY email")).mappings().all()
        alembic_run(fresh_db_url, "head")
        with engine.connect() as conn:
            after = conn.execute(text("SELECT * FROM users ORDER BY email")).mappings().all()
            assert [{k: v for k, v in row.items() if k != "clerk_sub"} for row in after] == before
            assert [row["clerk_sub"] for row in after] == [None, None, "user_abc"]
            indexes = dict(
                conn.execute(text("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users'")).all()
            )
            assert "ix_users_email" in indexes
            assert "UNIQUE" not in indexes["ix_users_email"]
            assert "users_email_key" not in indexes
        with pytest.raises(IntegrityError), engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO users (id, email, clerk_sub, created_at, default_format) "
                    "VALUES (:id, 'duplicate@test', 'user_abc', now(), 'epub')"
                ),
                {"id": uuid.uuid4()},
            )
        if duplicate_email:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "INSERT INTO users (id, email, created_at, default_format) "
                        "VALUES (:id, 'reader@example.test', now(), 'epub')"
                    ),
                    {"id": uuid.uuid4()},
                )
                snapshot = conn.execute(text("SELECT * FROM users ORDER BY id")).mappings().all()
            with pytest.raises(DBAPIError, match="Downgrade 0018 impossible.*emails en doublon"):
                alembic_run(fresh_db_url, "0017_device_email_address", direction="downgrade")
            with engine.connect() as conn:
                assert conn.execute(text("SELECT * FROM users ORDER BY id")).mappings().all() == snapshot
                assert conn.scalar(text("SELECT version_num FROM alembic_version")) == "0018_users_clerk_sub"
                indexes = dict(
                    conn.execute(text("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users'")).all()
                )
                assert "UNIQUE" not in indexes["ix_users_email"]
                assert "UNIQUE" in indexes["ix_users_clerk_sub"]
            print("downgrade avec doublons: refus explicite; revision 0018, donnees et index conserves")
            return
        alembic_run(fresh_db_url, "0017_device_email_address", direction="downgrade")
        with engine.connect() as conn:
            assert conn.execute(text("SELECT * FROM users ORDER BY email")).mappings().all() == before
            indexes = dict(
                conn.execute(text("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users'")).all()
            )
            assert "UNIQUE" in indexes["users_email_key"]
            assert "UNIQUE" not in indexes["ix_users_email"]
        with pytest.raises(IntegrityError), engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO users (id, email, created_at, default_format) "
                    "VALUES (:id, 'reader@example.test', now(), 'epub')"
                ),
                {"id": uuid.uuid4()},
            )
        print(
            "migration: backfill exact; autres colonnes intactes; NULL multiples permis; "
            "sub duplique refuse; ix_users_email non unique conserve; downgrade sans doublon restaure UNIQUE"
        )
    finally:
        engine.dispose()
