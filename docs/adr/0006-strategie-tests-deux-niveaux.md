# ADR 0006 — Stratégie de tests à deux niveaux

- **Statut** : accepté
- **Date** : 2026-09-07
- **Ticket** : FA-W01

## Contexte

~140 tests backend mockaient la session SQLAlchemy (`AsyncMock`). Ils ne pouvaient pas voir violations de FK, divergences Alembic/modèles, ni bugs de contraintes. La CI « verte » masquait des 500 en prod.

## Décision

Deux niveaux :

1. **Unitaires / API mockées** — `tests/` + `tests/fakes.py` : logique HTTP, auth, orchestration sans Postgres.
2. **Intégration Postgres réel** — `tests/integration/` contre `TEST_DATABASE_URL` : schéma, FK, migrations, cascades. Obligatoire dès qu'un ticket touche SQL (`where`, transaction, contrainte, migration).

Harnais : service Postgres en CI, sync modèles ↔ Alembic (`compare_metadata`), tests d'intégrité de schéma.

## Conséquences

- Plus lent / plus de infra CI, mais les bugs SQL sont détectés.
- Règle de « done » : tout SQL → test d'intégration (voir `AGENTS.md`).
- Les mocks restent pour le non-SQL (rapides, isolés).

## Alternatives écartées

- **Mocks seuls** — structurellement aveugles aux IntegrityError.
- **Uniquement intégration** — trop lent pour chaque handler ; mauvais ROI hors SQL.
- **SQLite en lieu de Postgres** — divergences de FK / types ; faux sentiment de sécurité.
