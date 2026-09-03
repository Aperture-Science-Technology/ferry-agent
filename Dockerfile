FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim
WORKDIR /app

# Calibre (ebook-convert) est optionnel : detecte au demarrage par
# services/converters.py, avec fallback PyMuPDF si absent. Non installe
# dans cette image de base pour la garder legere ; ajouter un paquet
# calibre ici si le fallback PyMuPDF ne suffit pas pour MOBI/AZW3.

COPY --from=builder /install /usr/local
COPY src ./src
COPY alembic.ini ./
COPY alembic ./alembic

ENV PYTHONPATH=/app/src

EXPOSE 8000
CMD ["uvicorn", "ferry_agent.main:app", "--host", "0.0.0.0", "--port", "8000"]
