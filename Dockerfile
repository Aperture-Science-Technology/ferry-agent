FROM python:3.13-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.13-slim
WORKDIR /app

# W-26 — Calibre en image core (pas gateway) :
# ebook-convert est requis pour EPUB→MOBI/AZW3 et PDF/MOBI→EPUB. Sans lui,
# les livraisons cloud / Kindle échouent ou mentaient via un fallback PDF.
# Coût assumé : ~150–300 Mo d'image en plus (calibre-bin + dépendances).
# Installé ici (root) avant USER appuser pour que le binaire soit exécutable
# par le même utilisateur non-root que le runtime uvicorn.
RUN apt-get update \
    && apt-get install -y --no-install-recommends calibre-bin \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY src ./src
COPY alembic.ini ./
COPY alembic ./alembic

RUN useradd --create-home --uid 10001 appuser
USER appuser

ENV PYTHONPATH=/app/src

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/healthz').status==200 else 1)"
CMD ["uvicorn", "ferry_agent.main:app", "--host", "0.0.0.0", "--port", "8000"]
