FROM python:3.13-slim

WORKDIR /app

# Installe les dépendances
RUN pip install --no-cache-dir "fastmcp==3.4.7" "httpx==0.28.1" "pydantic-settings==2.5.2"

# Copie le code
COPY ferry_mcp/ ./ferry_mcp/

RUN useradd --create-home --uid 10001 appuser
USER appuser

ENV FERRY_CORE_URL=http://ferry-core:8000
ENV PORT=8000

EXPOSE 8000

CMD ["python", "-m", "ferry_mcp.server"]
