FROM python:3.13-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.13-slim
WORKDIR /app

# Calibre (ebook-convert) est optionnel : detecte au demarrage par
# services/converters.py, avec fallback PyMuPDF si absent. Non installe
# dans cette image de base pour la garder legere ; ajouter un paquet
# calibre ici si le fallback PyMuPDF ne suffit pas pour MOBI/AZW3.

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
