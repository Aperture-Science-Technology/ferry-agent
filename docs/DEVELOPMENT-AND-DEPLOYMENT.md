# Ferry Agent — flux de développement et de déploiement

Ce document est la source de vérité opérationnelle. Les plans temporaires, prompts d’agents et logs de recette restent hors du dépôt, dans `~/.hermes/plans/`, et sont supprimés après la tâche. Les décisions durables vont dans `docs/adr/`.

## 1. Principes non négociables

- GitFlow : `feature/FA-*` → PR vers `develop` → PR vers `main`.
- Aucun commit direct sur `develop` ou `main`.
- Un seul agent Cursor travaille à la fois sur un même working tree.
- Cursor (`--model auto`) implémente ; GLaDOS vérifie, committe, pousse et fusionne.
- Un agent ne committe jamais et ne lance aucune commande Git qui écrit.
- Le backend, les contrats API, l’authentification, l’i18n et les comportements métier sont préservés pendant une refonte UI, sauf ticket explicite.
- Une maquette Pen est une spécification visuelle, pas du code à exporter. Ne jamais extrapoler un autre fichier Pen si la source demandée est absente.
- Production signifie trois preuves séparées : code fusionné, images publiées, conteneurs actifs et endpoint vérifié.
- Les volumes Docker sont persistants. Jamais de `docker compose down -v`, `docker volume rm` ou `docker system prune --volumes` sans confirmation explicite par volume.

## 2. Avant de commencer

```bash
cd /home/glados/projects/ferry-agent
git fetch origin --prune
git status -sb
git log --oneline --decorate -5
git remote -v
```

Si le working tree n’est pas propre, arrêter et inventorier les modifications. Ne jamais stasher, écraser ou réinitialiser le travail existant implicitement.

Pour une tâche design :

1. Vérifier le dépôt Pen (`/home/glados/projects/pen-dev-design`) et ses branches.
2. Localiser le fichier exact demandé, par nom **et par contenu sémantique**.
3. Vérifier les frames, composants, tokens et références réellement présents.
4. Si la source est absente, générique ou ne couvre pas l’écran demandé : bloquer l’implémentation et remonter l’écart. Ne pas remplacer silencieusement `ferry-landing.pen` par `ferry-dashboard.pen`.
5. Créer une branche design séparée et obtenir la validation de la direction sur un écran de référence avant l’implémentation.

## 3. Découpage des tickets

Chaque ticket possède :

- un objectif unique et un périmètre de fichiers autorisés ;
- les comportements et contrats à préserver ;
- les états obligatoires : loading, vide, erreur, succès, partiel, responsive ;
- les critères d’acceptation ;
- les commandes de vérification ;
- les preuves manquantes explicitement marquées `non vérifié`.

Pour une refonte UI, séquencer : `source/design validé → brand → shell → écran pilote → écrans principaux → écrans secondaires → convergence`. Ne pas lancer plusieurs agents sur les mêmes fichiers.

## 4. Délégation Cursor

Depuis le working tree de la feature :

```bash
agent -p "$(cat ~/.hermes/plans/<brief>.md)" \
  --model auto --trust --yolo
```

Pour une tâche longue, exécuter en arrière-plan avec un log hors dépôt. Le brief doit imposer :

- aucun commit et aucune commande Git d’écriture ;
- aucun élargissement de périmètre ;
- aucune nouvelle UI library, aucun CSS custom ou style inline ;
- i18n FR/EN symétrique et accessibilité ;
- rapport final séparant passé, bloqué, skipped et non vérifié.

Après l’agent, vérifier indépendamment :

```bash
git status -sb
git diff --name-only
git diff --check
git status --short --untracked-files=all
```

Inspecter les fichiers non suivis. Si l’agent a débordé du périmètre, arrêter, restaurer uniquement les fichiers hors lot et reprendre avec un brief ciblé.

## 5. Validation locale obligatoire

Adapter les commandes au lot, mais la convergence web doit couvrir au minimum :

```bash
cd web
npm ci
npm run check:i18n
npm run test:ui-harness
npm run test:product-truth
npm run lint
npm run build
```

Backend :

```bash
cd /home/glados/projects/ferry-agent
.venv/bin/python -m compileall src tests
.venv/bin/python -m pytest -q
```

Toute modification SQL, migration, transaction ou cascade exige les tests d’intégration avec un Postgres jetable et `TEST_DATABASE_URL`. Un test ignoré parce que Postgres manque n’est pas une validation d’intégration.

Pour une UI, capturer le rendu réel en FR et EN aux viewports `1440×1100`, `1024`, `768`, `390×844` et `320`. Vérifier overflow, images décodées, erreurs console, reduced-motion, menu mobile, focus et états importants. Une assertion DOM ou un build vert ne prouve pas le pixel-perfect.

## 6. Commit et PR

GLaDOS committe seulement après vérification :

```bash
git add <fichiers-du-lot>
git diff --cached --check
git commit -m "<type>(FA-XX): <résumé>"
git log -1 --format='%an <%ae>%n%B'
git push -u origin feature/FA-XX-<sujet>
```

Avant de créer une PR, rechercher une PR existante pour la même branche et la même base. Ne jamais dupliquer une PR.

Gate PR vers `develop` :

- diff limité au ticket ;
- tests locaux adaptés passés ;
- CI du `head_sha` exact en `completed/success` ;
- revue indépendante du composant parent et de ses styles hérités ;
- validation visuelle réelle, ou statut `non vérifié` clairement accepté.

Après un squash merge :

```bash
git fetch origin --prune
git checkout develop
git pull --ff-only origin develop
```

## 7. Promotion production

1. Créer la PR `develop → main`.
2. Vérifier les jobs du `head_sha` exact : tests, lint, build, scans et publication GHCR de `core`, `web`, `mcp-server` et `gateway`.
3. Merger uniquement quand les jobs requis sont verts.
4. Rafraîchir les refs locales et vérifier que `origin/main` et `origin/develop` correspondent à l’état attendu.
5. Vérifier Watchtower avant toute commande manuelle :

```bash
export DOCKER_HOST=tcp://127.0.0.1:2375
docker ps --filter label=com.centurylinklabs.watchtower.enable=true
```

6. Si Watchtower a recréé les services, vérifier les labels OCI et ne pas relancer Compose. Sinon, demander l’autorisation explicite avant toute recréation manuelle.
7. Vérifier le runtime :

```bash
docker ps -a --filter name=ferry-agent
docker inspect ferry-agent-web ferry-agent-core ferry-agent-mcp
docker logs ferry-agent-core --tail 100
curl -ksSL -o /dev/null -w '%{http_code} %{url_effective}\n' https://ferry-agent.aperture-agency.org/
```

Le bilan doit distinguer : commit fusionné, images publiées, conteneurs recréés, santé du core et réponse HTTP externe. Ne jamais annoncer « déployé » à partir d’un commit ou d’un run CI seul.

## 8. Nettoyage contrôlé

### Régénérable et supprimable après vérification

- `.next/`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/` ;
- `data/tmp/` ;
- captures et logs de recette ;
- briefs et prompts temporaires dans `~/.hermes/plans/` après clôture du ticket ;
- images Docker inutilisées via `docker image prune -a` ciblé ;
- cache BuildKit via `docker builder prune` ciblé.

### À conserver ou confirmer avant suppression

- `.env` et secrets ;
- volumes Docker nommés ;
- dépôts, branches non fusionnées et worktrees ;
- backups dont le contenu n’a pas été comparé ;
- ADR, runbooks et documentation de produit ;
- `node_modules/` si une reprise locale immédiate est prévue.

Avant toute suppression hors cache, comparer le contenu, vérifier l’état Git et produire la liste exacte. Le ménage ne doit jamais modifier le runtime ni supprimer les données applicatives.

## 9. Documentation durable

- `README.md` : démarrage et architecture courte.
- `AGENTS.md` : règles de contribution et de délégation.
- `docs/DEVELOPMENT-AND-DEPLOYMENT.md` : ce flux unique.
- `docs/adr/` : décisions d’architecture acceptées.
- `docs/ui-ux-review/` : spécification visuelle validée ; ne pas y déposer de logs ou prompts.
- `CHANGELOG.md` : changements livrés, pas journal de session.

Toute nouvelle procédure générale doit enrichir ce document ou un ADR existant, pas créer un nouveau fichier de plan permanent.
