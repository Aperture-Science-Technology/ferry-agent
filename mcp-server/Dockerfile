FROM python:3.13-slim

WORKDIR /app

# Installe les dépendances
COPY pyproject.toml ./
RUN pip install --no-cache-dir "fastmcp==3.4.7" httpx pydantic-settings

# Copie le code
COPY ferry_mcp/ ./ferry_mcp/

ENV FERRY_CORE_URL=http://ferry-core:8000
ENV PORT=8000

EXPOSE 8000

CMD ["python", "-m", "ferry_mcp.server"]
