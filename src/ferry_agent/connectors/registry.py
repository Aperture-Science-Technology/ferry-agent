"""Registry des connecteurs de sources legales disponibles."""

import logging

from ferry_agent.connectors import Connector
from ferry_agent.connectors.gutenberg import GutenbergConnector
from ferry_agent.connectors.standard_ebooks import StandardEbooksConnector
from ferry_agent.connectors.upload import UploadConnector

logger = logging.getLogger(__name__)

_CONNECTORS: dict[str, Connector] = {
    "gutenberg": GutenbergConnector(),
    "standard_ebooks": StandardEbooksConnector(),
    "upload": UploadConnector(),
}

# Connecteurs interroges par /api/v1/books/search (upload n'est pas cherchable).
_SEARCHABLE = ("gutenberg", "standard_ebooks")


def get_connector(name: str) -> Connector | None:
    return _CONNECTORS.get(name)


def get_search_connectors() -> list[Connector]:
    return [_CONNECTORS[name] for name in _SEARCHABLE]


def available_connector_names() -> list[str]:
    return list(_CONNECTORS.keys())


def log_startup() -> None:
    logger.info("Connecteurs enregistres: %s", ", ".join(available_connector_names()))
