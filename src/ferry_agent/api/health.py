"""Routes de sante publiques (aucune authentification, aucune DB requise)."""

from fastapi import APIRouter

from ferry_agent.services.converters import conversion_capacity

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/healthz")
async def healthz() -> dict:
    """Sante + capacite de conversion (ebook-convert), verifiable sans logs."""
    capacity = conversion_capacity()
    return {
        "status": "ok",
        "conversion": {
            "ebook_convert_available": capacity["ebook_convert_available"],
            "ebook_convert_version": capacity["ebook_convert_version"],
        },
    }
