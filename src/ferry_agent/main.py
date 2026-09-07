"""Point d'entree FastAPI de Ferry Agent."""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import jwt
from fastapi import FastAPI
from sqlalchemy import delete

from ferry_agent.api import books, covers, deliveries, devices, gateways, health, sources, tierc, users
from ferry_agent.config import Settings, get_settings
from ferry_agent.connectors.registry import log_startup
from ferry_agent.db import async_session_factory
from ferry_agent.models import ShortCode
from ferry_agent.services import gateways as gateway_service
from ferry_agent.services.converters import calibre_status_line

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _purge_loop(settings: Settings) -> None:
    """Purge periodique des GatewayJob termines et ShortCode expires.

    S'execute dans **chaque** replique du core. Prevoir un ``pg_advisory_lock``
    le jour ou le core est scale horizontalement, pour n'avoir qu'un seul
    worker qui purge a la fois.
    """
    while True:
        try:
            async with async_session_factory() as db:
                deleted_jobs = await gateway_service.purge_finished_jobs(
                    db, settings.gateway_job_retention_days
                )
                logger.info("purge gateway_jobs: %d ligne(s) supprimee(s)", deleted_jobs)

                short_result = await db.execute(
                    delete(ShortCode).where(
                        ShortCode.expires_at < datetime.now(timezone.utc)
                    )
                )
                await db.commit()
                logger.info(
                    "purge short_codes: %d ligne(s) supprimee(s)",
                    int(short_result.rowcount or 0),
                )
        except Exception:
            logger.exception("echec de la tache de purge")
        await asyncio.sleep(settings.gateway_job_purge_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    if settings.clerk_issuer:
        jwks_url = settings.clerk_issuer.rstrip("/") + "/.well-known/jwks.json"
        app.state.jwks_client = jwt.PyJWKClient(jwks_url)
        logger.info("Auth Clerk: JWKS charge depuis %s", jwks_url)
    else:
        app.state.jwks_client = None
        logger.warning("Auth Clerk: CLERK_ISSUER absent -> mode dev (X-Dev-User), a ne jamais activer en prod")

    log_startup()
    logger.info(calibre_status_line())

    purge_task = asyncio.create_task(_purge_loop(settings), name="gateway-job-purge")
    logger.info(
        "Tache de purge GatewayJob/ShortCode activee (retention=%d j, interval=%d s)",
        settings.gateway_job_retention_days,
        settings.gateway_job_purge_interval_seconds,
    )

    yield

    purge_task.cancel()
    try:
        await purge_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Ferry Agent", version="0.1.0", lifespan=lifespan)

app.include_router(health.router)
app.include_router(books.router)
app.include_router(covers.router)
app.include_router(devices.router)
app.include_router(deliveries.router)
app.include_router(gateways.router)
app.include_router(sources.router)
app.include_router(users.router)
app.include_router(tierc.router)
