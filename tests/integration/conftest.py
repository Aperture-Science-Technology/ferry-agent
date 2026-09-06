"""Harnais d'integration contre un Postgres reel.

Isolation
---------
On recree une base ephemere **par module de test**, pas par fonction, et on
n'utilise pas le patron « transaction externe rollbackee ».

Les services (`ferry_agent.services.*`) appellent `db.commit()` partout.
Un savepoint (`session.begin_nested()` + listener `after_transaction_end`)
casse des qu'un commit ferme la transaction externe, et le DDL Alembic
(`ALTER TYPE ... ADD VALUE`) refuse de s'executer dans une transaction
imbriquee. Recreer la base par module survive aux `commit()` et au DDL ;
c'est plus lent qu'un rollback mais c'est l'option robuste.

`postgres_url` reste de portee session (cible d'admin / skip si down).
`migrated_db` est de portee **module** (ecart assume par rapport a une
portee session unique : une base partagee entre modules laisserait les
`commit()` d'un fichier polluer le suivant).

`test_upgrade_then_downgrade_to_base` utilise `fresh_db_url` (base vierge
dediee) pour ne pas laisser le schema du module a la revision `base`.
"""

from __future__ import annotations

import os
import uuid
from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import psycopg
import pytest
from psycopg import sql
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

ROOT = Path(__file__).resolve().parents[2]
ALEMBIC_INI = ROOT / "alembic.ini"
DEFAULT_TEST_DATABASE_URL = "postgresql+asyncpg://ferry:ferry@localhost:5432/ferry_test"


def _render(url) -> str:
    return url.render_as_string(hide_password=False)


def _async_url_with_database(async_url: str, database: str) -> str:
    return _render(make_url(async_url).set(database=database))


def _psycopg_conninfo(async_url: str, database: str) -> str:
    return _render(make_url(async_url).set(drivername="postgresql", database=database))


def _admin_conninfo(async_url: str) -> str:
    """Conninfo synchrone vers une base de maintenance (CREATE/DROP DATABASE)."""
    parsed = make_url(async_url)
    last_error: Exception | None = None
    for candidate in ("postgres", parsed.database or "ferry_test"):
        conninfo = _psycopg_conninfo(async_url, candidate)
        try:
            with psycopg.connect(conninfo, connect_timeout=3) as conn:
                conn.execute("SELECT 1")
            return conninfo
        except psycopg.Error as exc:
            last_error = exc
            continue
    raise ConnectionError("aucune base de maintenance joignable") from last_error


def create_database(admin_conninfo: str, name: str) -> None:
    with psycopg.connect(admin_conninfo, autocommit=True) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))


def drop_database(admin_conninfo: str, name: str) -> None:
    with psycopg.connect(admin_conninfo, autocommit=True) as conn:
        conn.execute(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            "WHERE datname = %s AND pid <> pg_backend_pid()",
            (name,),
        )
        conn.execute(sql.SQL("DROP DATABASE IF EXISTS {}").format(sql.Identifier(name)))


def run_alembic(async_url: str, revision: str, *, direction: str = "upgrade") -> None:
    """Execute Alembic en pointant `sqlalchemy.url` sur la base de test.

    `alembic/env.py` lit l'URL injectee via `Config.attributes["connection_url"]`
    (sans ecraser avec `DATABASE_URL` applicatif).
    """
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(ALEMBIC_INI))
    cfg.set_main_option("script_location", str(ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", async_url)
    cfg.attributes["connection_url"] = async_url
    if direction == "upgrade":
        command.upgrade(cfg, revision)
    elif direction == "downgrade":
        command.downgrade(cfg, revision)
    else:
        raise ValueError(f"direction Alembic inconnue: {direction}")


def sync_psycopg_url(async_url: str) -> str:
    return _render(make_url(async_url).set(drivername="postgresql+psycopg"))


@pytest.fixture(scope="session")
def postgres_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL", DEFAULT_TEST_DATABASE_URL)
    try:
        with psycopg.connect(_admin_conninfo(url), connect_timeout=3) as conn:
            conn.execute("SELECT 1")
    except Exception:
        pytest.skip("Postgres indisponible")
    return url


@pytest.fixture(scope="session")
def alembic_run():
    return run_alembic


@pytest.fixture(scope="session")
def to_sync_url():
    return sync_psycopg_url


@pytest.fixture
def fresh_db_url(postgres_url: str) -> Iterator[str]:
    """Base ephemere vierge (sans migrations), detruite en teardown."""
    name = f"ferry_it_{uuid.uuid4().hex[:12]}"
    admin = _admin_conninfo(postgres_url)
    create_database(admin, name)
    url = _async_url_with_database(postgres_url, name)
    try:
        yield url
    finally:
        drop_database(admin, name)


@pytest.fixture(scope="module")
def migrated_db(postgres_url: str) -> Iterator[str]:
    """Base ephemere migree jusqu'a `head`, detruite en teardown du module."""
    name = f"ferry_it_{uuid.uuid4().hex[:12]}"
    admin = _admin_conninfo(postgres_url)
    create_database(admin, name)
    url = _async_url_with_database(postgres_url, name)
    try:
        run_alembic(url, "head", direction="upgrade")
        yield url
    finally:
        drop_database(admin, name)


@pytest.fixture
async def db_session(migrated_db: str) -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(migrated_db, pool_pre_ping=True, poolclass=NullPool)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest.fixture
async def client(db_session: AsyncSession):
    """Client HTTP ASGI avec DB de test et utilisateur fabrique (sans Clerk)."""
    from httpx import ASGITransport, AsyncClient

    from ferry_agent.api.deps import CurrentUser, get_current_user
    from ferry_agent.db import get_db
    from ferry_agent.main import app
    from ferry_agent.models import User

    user = User(email=f"it-{uuid.uuid4().hex}@example.test")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    current = CurrentUser(id=user.id, email=user.email)

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = lambda: current
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
    finally:
        app.dependency_overrides.clear()
