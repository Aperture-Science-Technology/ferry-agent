# AGENTS.md — consignes pour agents (ferry-agent)

Ce fichier s'applique à **tout** le mono-repo (core, mcp-server, gateway, web, deploy).  
`web/AGENTS.md` est généré par Next.js et ne remplace pas ce document.

## Règle de « done » (non négociable)

Un ticket n'est terminé que si **toutes** les conditions suivantes sont réunies :

1. **CI verte** (tests, lint, jobs requis par le workflow).
2. **Au moins un test de régression** qui échouait avant le correctif et passe après (pas un test qui vérifie seulement qu'une fonction est appelée).
3. Si le ticket touche le **SQL** (schéma, `where`, transaction, contrainte, migration) → **test d'intégration Postgres réel** (`tests/integration/`, `TEST_DATABASE_URL`).
4. Si le ticket ajoute ou modifie un **texte visible par l'utilisateur** → **charte non-tech** (Décision B / [ADR 0007](docs/adr/0007-charte-documentation-non-technique.md)) : langage simple, pas de jargon interne ; `web/messages/fr.json` et `en.json` restent **strictement symétriques**.

## Dette locale : `TODO(FA-XXX)`

Convention imposée :

```python
# TODO(FA-W31): #31 <quoi> — <pourquoi différé>
```

- `FA-WXX` (ou autre ticket `FA-…`) dans les parenthèses — obligatoire (ruff **TD002**).
- Marqueur d'issue `#NN` (ou URL / commentaire `# WNN` sur la ligne suivante) — obligatoire (ruff **TD003**).
- Un `TODO` sans référence ticket est **refusé** (lint + revue).

## ADR obligatoires

Toute décision d'architecture **prise** → un fichier `docs/adr/NNNN-titre.md` (format : [ADR 0001](docs/adr/0001-format-des-adr.md)).  
Les arbitrages **différés** restent des `TODO(FA-XXX)`, pas des ADR.

## Distribution gateway (rappel)

- **Canal principal** : GUI (OrbStack / Docker Desktop) + tarball **docker-format par architecture** — voir [ADR 0005](docs/adr/0005-distribution-canal-gui.md).
- **Jamais** de layout OCI comme artefact utilisateur.
- **Jamais** de tuto à trous (`CODE` à remplacer) : bloc copier-coller des **deux** secrets.
- Validation réelle **avant** d'écrire le guide / les textes dashboard.

## Charte non-tech (rappel)

Tout texte utilisateur final suit [ADR 0007](docs/adr/0007-charte-documentation-non-technique.md).  
README / `--help` opérateur peuvent rester techniques.
