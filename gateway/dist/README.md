# Ferry Gateway — artefacts opérateurs (W-20)

Fichiers **statiques** servis sous `/bundle` et joints aux GitHub Releases.
Ce n’est **pas** le guide utilisateur (W-24).

## Architectures

| Fichier Release | Plateforme |
| --- | --- |
| `ferry-gateway-<version>-amd64.tar.gz` | `linux/amd64` |
| `ferry-gateway-<version>-arm64.tar.gz` | `linux/arm64` |

Format **docker** uniquement (`docker buildx … --output type=docker`). **Pas** de layout OCI.

## Intégrité

Sur la Release GitHub du tag `v<version>` :

1. Télécharger `SHA256SUMS` + `SHA256SUMS.sig` + le `.tar.gz` de votre arch.
2. Vérifier les sommes :
   ```sh
   sha256sum -c SHA256SUMS
   ```
3. Vérifier la signature (cosign keyless / OIDC GitHub Actions) :
   ```sh
   cosign verify-blob --bundle SHA256SUMS.sig \
     --certificate-identity-regexp='^https://github.com/aperture-science-technology/ferry-agent/' \
     --certificate-oidc-issuer='https://token.actions.githubusercontent.com' \
     SHA256SUMS
   ```

## Charger l’image

```sh
docker load -i ferry-gateway-<version>-amd64.tar.gz
docker images | grep ferry-agent/gateway
# attendu : ghcr.io/aperture-science-technology/ferry-agent/gateway:<version>
#           (+ tag latest dans le même tar)
```

Puis `./install.sh` (à côté de `compose.yaml`) ou :

```sh
export PAIRING_TOKEN=… GATEWAY_KEY=… GATEWAY_IMAGE_TAG=<version>
docker compose -f compose.yaml up -d
```

## Fichiers de ce dossier

| Fichier | Rôle |
| --- | --- |
| `compose.yaml` | Stack all-in-one (`./downloads` + `./watch` montés) |
| `install.sh` | Assistant d’install (load local / pull / compose) |
| `ferry-gateway.command.tmpl` | Gabarit lanceur macOS (C2b) |
| `ferry-gateway.bat.tmpl` | Gabarit lanceur Windows (C3) |

Le dossier `./watch` (monté sur `/watch`) reçoit les fichiers à importer : posez un fichier dedans, il arrive tout seul dans votre bibliothèque.

Les tarballs **versionnés par architecture** (`ferry-gateway-<version>-*.tar.gz`)
se téléchargent depuis GitHub Releases. Le guide public pointe vers l’archive
canonique `/bundle/ferry-agent-gateway.tar`. Aucun `ferry-agent-bundle.tar.gz`
n’est publié.

## Contrat web (`/[locale]/docs`)

Un seul bouton de téléchargement, URL fixe (voir `web/lib/gateway-image.ts`) :

```
https://ferry-agent.aperture-agency.org/bundle/ferry-agent-gateway.tar
```

Pas de choix d’architecture, pas de version affichée, pas de fallback GitHub
dans le guide utilisateur.
