# LOT 8 — Convergence, CI et matrice de recette

**Branche** : `feature/FA-DASHBOARD-IMPLEMENTATION-01`
**Commits vérifiés (lots 1–7)** : `225c381`, `1414150`, `c6fa735`, `b05e883`, `488ba0f`, `8ccea0a`, `e19eb2d`
**Design Pen corrigé** : `/home/glados/projects/pen-dev-design/design/ferry-dashboard.pen` @ `2a4c099` (référence, non exécuté ici)
**Date locale** : 2026-09-23
**Environnement** : Node `v22.22.3`, Next.js `16.3.4`
**Périmètre LOT 8** : garde-fous CI + contrôles de convergence + matrice de validations encore manquantes. Aucun nouveau comportement métier. Aucune capture visuelle inventée.

---

## 1. CI branchée (local YAML uniquement)

**Job ciblé** : `types-freshness` (`Types freshness + i18n`) — **Node 22**
**Triggers inchangés** : `push` / `pull_request` sur `develop` + `main` (+ `workflow_dispatch`). Une PR depuis cette feature branch vers `develop`/`main` déclenche la validation. Les push feature seuls ne déclenchent pas le workflow (politique FA-CI-PR-GATES).

**Gates de publication inchangées** : `build-push-*` gardent `needs: [python-tests, web-build, lint, gateway-tests]` et les `if` main/tag existants. `types-freshness` n’est pas ajouté aux `needs` publish.

**Scripts réellement exécutés dans le job** (pas de logique recopiée) :

| Étape | Commande |
|---|---|
| i18n | `npm run check:i18n` |
| product-truth | `npm run test:product-truth` |
| library | `npm run test:library` |
| deliveries + devices | `npm run test:delivery-devices` |
| gateways | `npm run test:gateways` |
| sources + settings | `npm run test:sources-settings` |
| final | `npm run test:final` |
| UI harness | `npm run test:ui-harness` |
| ESLint web | `npm run lint` |

**CI distante** : **non vérifiée** dans cette session (pas de push / pas de consultation GH Actions).

---

## 2. Contrôles de convergence (code)

| Contrôle | Résultat |
|---|---|
| Aucun `style={{` nouvellement introduit dans dashboard (`web/components/app`, `web/app/**/app`) | **passé** |
| Aucun `data-vertical:self-auto` | **passé** (`separator.tsx` conserve `data-vertical:self-stretch`) |
| Wrapper fixe du Separator vertical (`dashboard-header` → `div.h-4`) | **passé** (inspection) |
| FR/EN symétriques | **passé** (`check:i18n` — 666 clés) |
| Pas de dark-teal dominant / inventé | **passé** (commentaires anti-teal QR/status seulement) |
| Pas de source locale / delete source inventé | **passé** |
| Auth Clerk, routes app, contrats API | **passé** (aucun diff lots vs `a862438` sur `proxy.ts`, `openapi.json`, `api-types`) |
| Secrets Gateway/OPDS absents des snapshots | **passé** (aucun `toMatchSnapshot` ; fixtures de test non snapshotées) |

---

## 3. Vérifications comportementales exécutées localement

| Commande | Exit | Verdict |
|---|---|---|
| `npm run check:i18n` | 0 | **passé** |
| `npm run test:library` | 0 | **passé** (16) |
| `npm run test:delivery-devices` | 0 | **passé** (13) |
| `npm run test:gateways` | 0 | **passé** |
| `npm run test:sources-settings` | 0 | **passé** (16) |
| `npm run test:final` | 0 | **passé** (3) |
| `npm run test:product-truth` | 0 | **passé** (5) |
| `npm run test:ui-harness` | 0 | **passé** (10 files / 35 tests) |
| `npm run lint` | 0 | **passé** |
| `npm run build` | 0 | **passé** |
| `pytest .github/tests/test_ci_pr_gates_policy.py` | 0 | **passé** (41) |

---

## 4. Matrice de validations visuelles encore manquantes

Ces cases **n’ont pas** été validées par capture navigateur dans le LOT 8. Le harnais Vitest ne remplace pas une recette visuelle (ADR 0009). Cocher lors d’une session humaine / browser.

### 4.1 Auth & session

| Case | Viewport | FR | EN | Statut |
|---|---|---|---|---|
| Sign-in Clerk → redirection `/app` | 1440×1100 | ☐ | ☐ | **non vérifié** |
| Session expirée / retour login | 390×844 | ☐ | ☐ | **non vérifié** |
| UserButton compte (Plus / sidebar) | 767 / 768 | ☐ | ☐ | **non vérifié** |

### 4.2 Viewports & breakpoints

| Case | 1440×1100 | 1024 | 767 | 768 | 390×844 | 320 | Statut |
|---|---|---|---|---|---|---|---|
| Shell sidebar vs mobile Plus | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | **non vérifié** (comportement Plus couvert partiellement par harness, pas le layout) |
| Bibliothèque table ↔ cartes | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | **non vérifié** |
| Livraisons liste / détail | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | **non vérifié** |
| Appareils identité longue | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | **non vérifié** |
| Gateway codes / empty | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | **non vérifié** |
| Sources toggles | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | **non vérifié** |
| Réglages + QR OPDS | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | **non vérifié** |

### 4.3 Langues

| Case | FR | EN | Statut |
|---|---|---|---|
| Libellés longs (titres, CTA, empty states) | ☐ | ☐ | **non vérifié** (symétrie clés OK ; rendu longueur non mesuré) |
| Switch langue depuis Plus / sidebar | ☐ | ☐ | **non vérifié** |

### 4.4 États métier (par surface)

| État | Library | Deliveries | Devices | Gateway | Sources | Settings | Statut |
|---|---|---|---|---|---|---|---|
| Vide | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | **non vérifié** visuellement (harness logique/rendu partiel) |
| Courant | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | **non vérifié** |
| Unavailable ≠ empty | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | **partiel** (harness) / **non vérifié** visuel |
| Partial refresh | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | **partiel** (harness) / **non vérifié** visuel |
| Erreur action (PATCH/POST) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | **partiel** (harness) / **non vérifié** visuel |

### 4.5 Dialogs, Plus, focus, reduced motion

| Case | Statut |
|---|---|
| Dialogs (deliver, create gateway, device CRUD, OPDS create/revoke) — focus trap + Esc + retour focus | **non vérifié** |
| Mobile **Plus** — ouverture, destinations, fermeture, focus | **partiel** (harness ouvre destinations) / **non vérifié** focus & layout |
| Clavier seul sur formulaires réglages / sources | **non vérifié** |
| `prefers-reduced-motion` | **non vérifié** |
| Zoom 200 % / reflow | **non vérifié** |

### 4.6 Référence design

| Case | Statut |
|---|---|
| Comparaison écran ↔ Pen `ferry-dashboard.pen` @ `2a4c099` | **non vérifié** (aucune capture) |

---

## 5. Synthèse LOT 8

| Catégorie | Verdict |
|---|---|
| Scripts test locaux | **passé** |
| Lint + build | **passé** |
| Convergence code (style, Separator, i18n, secrets, contrats) | **passé** |
| CI YAML branchée (job Node 22) | **passé** (fichier local) |
| CI distante GitHub Actions | **non vérifié** |
| Recette visuelle navigateur | **non vérifié** (matrice §4) |
| Commit / push | **skipped** (consigne LOT 8) |

**Bloqué** : rien de bloquant côté scripts locaux.
**Done AGENTS.md** : **non atteint** tant que CI distante + au moins une preuve de régression visuelle/humaine sur les cases critiques restent ouvertes.
