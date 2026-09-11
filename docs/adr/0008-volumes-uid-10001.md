# ADR 0008 — Volumes library/tmp inscriptibles par UID 10001

- **Statut** : accepté
- **Date** : 2026-09-11
- **Ticket** : ops (suite FA-W14)

## Contexte

Le core tourne en `appuser` (UID/GID **10001**, FA-W14). Les volumes nommés `ferry_library` et `ferry_tmp` montés sur `/data/library` et `/data/tmp` sont créés par Docker en `root:root` `0755`. Le processus non-root échoue alors au premier écriture (`import_from_gateway`, connecteurs, conversions) avec `PermissionError`. Contraintes : ne pas supprimer/recréer les volumes, ne pas toucher aux fichiers de sécurité système, garder le conteneur core non-root pendant tout son runtime.

## Décision

1. **Service Compose one-shot `volume-init`** (`alpine`, `user: "0:0"`) qui exécute `chown -R 10001:10001` + `chmod 0755` sur les deux montages, puis s'arrête. `ferry-agent-core` dépend de `service_completed_successfully`.
2. **`deploy.sh`** relance explicitement `docker compose run --rm --no-deps volume-init` à chaque déploiement (un one-shot `restart: "no"` déjà terminé n'est pas rejoué par un simple `up -d`).
3. **Dockerfile core** : créer `/data/library` et `/data/tmp` avec ownership `appuser` (filet pour premier peuplement d'un volume vide ; insuffisant seul pour un volume déjà `root:root`).

## Conséquences

- Les volumes existants deviennent inscriptibles **sans** wipe.
- Le runtime core reste non-root ; seul le job d'init est root et éphémère.
- Chaque `deploy.sh` réapplique le `chown` (idempotent).
- Dépendance légère à l'image `alpine:3.20` sur l'hôte de déploiement.

## Alternatives écartées

- **Entrypoint core root → drop privileges** — fonctionne, mais élargit la surface root de l'image applicative alors que FA-W14 a figé `USER appuser`.
- **Seulement `mkdir`/`chown` dans le Dockerfile** — Docker ne réapplique pas l'ownership sur un volume nommé déjà peuplé / créé `root:root`.
- **`chmod 777` ou userns / fichiers sécu hôte** — trop large ou hors périmètre (fichiers de sécurité système exclus).
- **Supprimer/recréer les volumes** — perte des ebooks stockés ; interdit.
