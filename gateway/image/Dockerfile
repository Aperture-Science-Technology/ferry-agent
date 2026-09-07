# Ferry Agent all-in-one gateway image.
#
# Build from the ferry-agent repository root:
#   docker build -f gateway/image/Dockerfile -t ferry-gw:test gateway/

FROM python:3.12-slim

ARG PROWLARR_VERSION=2.5.2.5491
ARG TARGETARCH

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/opt/gateway-agent \
    PLATFORM_URL=https://ferry-agent.aperture-agency.org \
    PROWLARR_URL=http://127.0.0.1:9696 \
    TRANSMISSION_URL=http://127.0.0.1:9091 \
    DOWNLOAD_PATH=/downloads \
    STATE_PATH=/state/state.json \
    PUID=1000 \
    PGID=1000 \
    TZ=UTC \
    PROWLARR_VERSION=${PROWLARR_VERSION}

RUN apt-get update \
    && icu_pkg="$(apt-cache search --names-only '^libicu[0-9]+$' | awk '{print $1}' | sort -V | tail -1)" \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        openssl \
        supervisor \
        transmission-daemon \
        tzdata \
        ${icu_pkg} \
    && rm -rf /var/lib/apt/lists/* \
    && (service transmission-daemon stop >/dev/null 2>&1 || true) \
    && rm -f /etc/init.d/transmission-daemon \
    && useradd --create-home --uid 1000 --shell /usr/sbin/nologin abc \
    && mkdir -p /config /downloads /state /var/log/supervisor

# Official self-contained Prowlarr build (includes the .NET runtime).
RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) arch=x64 ;; \
      arm64) arch=arm64 ;; \
      *) echo "unsupported TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/prowlarr.tar.gz \
      "https://github.com/Prowlarr/Prowlarr/releases/download/v${PROWLARR_VERSION}/Prowlarr.master.${PROWLARR_VERSION}.linux-core-${arch}.tar.gz"; \
    tar -xzf /tmp/prowlarr.tar.gz -C /opt; \
    rm -f /tmp/prowlarr.tar.gz; \
    test -x /opt/Prowlarr/Prowlarr; \
    printf '%s\n' "${PROWLARR_VERSION}" > /opt/Prowlarr/VERSION

WORKDIR /opt/gateway-agent

COPY agent/requirements.txt agent/pyproject.toml ./
COPY agent/ferry_gateway_agent ./ferry_gateway_agent

RUN pip install --no-cache-dir . \
    && python -c "from ferry_gateway_agent import __version__; print(__version__)"

COPY image/entrypoint.sh image/run-gateway-agent.sh image/ensure_prowlarr_user.py \
    image/healthcheck.sh /usr/local/bin/
COPY image/supervisord.conf /etc/supervisor/supervisord.conf

RUN chmod 755 /usr/local/bin/entrypoint.sh /usr/local/bin/run-gateway-agent.sh \
        /usr/local/bin/ensure_prowlarr_user.py /usr/local/bin/healthcheck.sh \
    && chown -R abc:abc /config /downloads /state

VOLUME ["/config", "/downloads", "/state"]

# 9696 = Prowlarr admin UI. Prefer publishing as 127.0.0.1:9696:9696;
# Forms auth is required (credentials in /config/prowlarr-credentials).
EXPOSE 9696 51413/tcp 51413/udp

# start-period covers Prowlarr boot + gateway pairing/startup before honest checks.
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=5 \
    CMD ["/usr/local/bin/healthcheck.sh"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["run"]
