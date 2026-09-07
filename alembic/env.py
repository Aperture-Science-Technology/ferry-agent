import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from ferry_agent.config import get_settings
from ferry_agent.db import Base

# Importer les modeles pour peupler Base.metadata avant l'autogenerate.
from ferry_agent import models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _resolve_database_url() -> str:
    """URL de la cible Alembic.

    Les tests d'integration injectent une base ephemere via
    `Config.attributes["connection_url"]` (et `set_main_option("sqlalchemy.url")`).
    Sans injection, on retombe sur `DATABASE_URL` applicatif. On ne doit pas
    ecraser un URL deja pose sur le Config : alembic.ini a toujours une valeur
    de repli, d'ou l'attribut dedie plutot qu'un test "url deja rempli".
    """
    injected = config.attributes.get("connection_url")
    if injected:
        return injected
    return get_settings().database_url


config.set_main_option("sqlalchemy.url", _resolve_database_url())


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable: AsyncEngine = create_async_engine(config.get_main_option("sqlalchemy.url"))

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
