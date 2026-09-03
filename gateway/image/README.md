# All-in-one Ferry Agent gateway image

One container: transmission-daemon, Prowlarr, and the Python gateway agent.

## Build

From the ferry-agent repository root:

```sh
docker build -f gateway/image/Dockerfile -t ferry-gw:test gateway/
```

Pinned Prowlarr version: `2.5.2.5491` (`ARG PROWLARR_VERSION`).
