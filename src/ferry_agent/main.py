"""Point d'entree FastAPI de Ferry Agent."""

import logging
from contextlib import asynccontextmanager

import jwt
from fastapi import FastAPI

from ferry_agent.api import books, deliveries, devices, gateways, health, tierc
from ferry_agent.config import get_settings
from ferry_agent.connectors.registry import log_startup
from ferry_agent.services.converters import calibre_status_line

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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

    yield


app = FastAPI(title="Ferry Agent", version="0.1.0", lifespan=lifespan)

app.include_router(health.router)
app.include_router(books.router)
app.include_router(devices.router)
app.include_router(deliveries.router)
app.include_router(gateways.router)
app.include_router(tierc.router)
