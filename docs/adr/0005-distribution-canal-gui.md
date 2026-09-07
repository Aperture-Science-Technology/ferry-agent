# ADR 0005 — Distribution : canal GUI principal

- **Statut** : accepté
- **Date** : 2026-09-07
- **Tickets** : FA-W20 → FA-W24

## Contexte

L'installation gateway chez un utilisateur non-technique était un tuto à trous (`CODE` à remplacer, `GATEWAY_KEY` omis) et des artefacts fantômes. Il fallait un parcours cible unique et honnête.

## Décision

| Rang | Canal |
|---|---|
| **Principal** | GUI (OrbStack / Docker Desktop) + **tarball docker-format par arch** (amd64, arm64) |
| Secondaire | Registre **GHCR** (`docker pull`) |
| Filet | Lanceur `.command` / `.bat` |
| Homelab | `compose.yaml` + `install.sh` |

Interdits : layout **OCI**, tar multi-arch unique, tuto à trous. Validation réelle (machines) **avant** rédaction du guide / textes dashboard. Bloc copier-coller des **deux** secrets (`PAIRING_TOKEN` + `GATEWAY_KEY`).

## Conséquences

- CI produit des tarballs signés + SHA256SUMS ; `deploy.sh` sert `/bundle`.
- Guides et UI parlent d'abord au parcours GUI (Décision B / ADR 0007).
- Homelab et lanceurs restent supportés mais non prioritaires.

## Alternatives écartées

- **OCI / `docker load` multi-arch unique** — incompatible avec l'import GUI simple par arch.
- **« 0 commande / glisser-déposer » promis sans validation** — mensonge produit ; friction `pull`/`load` assumée.
- **Guide avant validation W-22** — reproduit des gestes qui n'existent pas dans l'app.
