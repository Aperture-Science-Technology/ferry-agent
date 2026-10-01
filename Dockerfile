FROM python:3.13-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.13-slim
WORKDIR /app

# W-26 / FA-FIX-CALIBRE-01 — Calibre en image core (pas gateway) :
# ebook-convert est requis pour EPUB→MOBI/AZW3 et PDF/MOBI→EPUB. Sans lui,
# les livraisons cloud / Kindle échouent (FA-W26 a retiré le fallback silencieux).
# Sur Debian 13 (trixie), python:3.13-slim ne fournit plus ebook-convert via
# calibre-bin (plugins .so uniquement) : le binaire est dans le paquet calibre.
# Coût assumé : plus lourd que calibre-bin seul ; --no-install-recommends limite
# le surplus. Installé ici (root) avant USER appuser pour que le binaire soit
# exécutable par le même utilisateur non-root que le runtime uvicorn.
RUN apt-get update \
    && apt-get install -y --no-install-recommends calibre \
    && rm -rf /var/lib/apt/lists/* \
    && ebook-convert --version

COPY --from=builder /install /usr/local
COPY src ./src
COPY alembic.ini ./
COPY alembic ./alembic

# /data/{library,tmp} match prod volume mount points. Ownership helps empty
# named-volume first populate; existing root-owned volumes are fixed by the
# compose `volume-init` one-shot (see docs/adr/0008-volumes-uid-10001.md).
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /data/library /data/tmp \
    && chown -R appuser:appuser /data/library /data/tmp
USER appuser

ENV PYTHONPATH=/app/src

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/healthz').status==200 else 1)"
CMD ["uvicorn", "ferry_agent.main:app", "--host", "0.0.0.0", "--port", "8000"]
