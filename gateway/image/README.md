# All-in-one Ferry Agent gateway image

One container: transmission-daemon, Prowlarr, and the Python gateway agent.

## Build

From the ferry-agent repository root:

```sh
docker build -f gateway/image/Dockerfile -t ferry-gw:test gateway/
```

Pinned Prowlarr version: `2.5.2.5491` (`ARG PROWLARR_VERSION`).

## Ports

- **9696** — Prowlarr UI (admin: indexer credentials). Prefer localhost only:

  ```sh
  -p 127.0.0.1:9696:9696
  ```

  Publishing `9696` on `0.0.0.0` deliberately exposes that admin UI on your
  LAN. Forms authentication is enabled; generated credentials live in
  `/config/prowlarr-credentials` (`user=ferry`). On first start the
  container logs:

  `Prowlarr UI: http://127.0.0.1:9696 — user=ferry, password stored in /config/prowlarr-credentials`

- **51413/tcp+udp** — Transmission peer port
- **9091** — Transmission RPC (bound inside the container; publish only if needed)

## Example

```sh
docker run -d --name ferry-gateway --restart unless-stopped \
  -e PAIRING_TOKEN=YOUR_TOKEN -e GATEWAY_KEY=YOUR_KEY \
  -e PUID=$(id -u) -e PGID=$(id -g) \
  -p 127.0.0.1:9696:9696 \
  -p 51413:51413 -p 51413:51413/udp \
  -v "$PWD/downloads:/downloads" \
  -v ferry-gw-config:/config \
  -v ferry-gw-state:/state \
  ferry-gw:test
```
