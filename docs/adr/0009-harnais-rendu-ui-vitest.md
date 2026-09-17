# ADR 0009 — Harnais de rendu UI (Vitest)

- **Statut** : accepté
- **Date** : 2026-09-17
- **Ticket** : FA-UI-HARNESS-01

## Contexte

Les suites frontend existantes (`node --experimental-strip-types --test`) couvrent la logique pure (état, filtres, product-truth). Elles ne peuvent pas monter un composant React ni charger `app/globals.css`. Il manquait un chemin reproductible pour assertiver un rendu réel sans toucher aux écrans produit.

## Décision

Ajouter un harnais minimal sous `web/` :

- **Vitest 4** + **happy-dom** + **Testing Library** (`@testing-library/react`)
- Config dédiée `web/vitest.config.mts`, bootstrap `web/harness/setup.ts` (importe `globals.css`)
- Commande officielle : `npm run test:ui-harness` (dans `web/`)
- Les suites `node:test` restent inchangées

Le transform JSX repose sur oxc (intégré à Vite/Vitest) — pas de `@vitejs/plugin-react` (conflit peer Babel avec `shadcn` dans ce dépôt).

## Conséquences

- On peut rendre un composant UI réel avec le pipeline CSS PostCSS/Tailwind du projet.
- Coût : quelques devDependencies et une commande séparée ; pas de navigateur réel.
- Les validations layout/focus/visuelles navigateur restent hors scope de ce harnais.

## Alternatives écartées

- **Étendre `node:test` seul** — pas de JSX ni de pipeline CSS sans outillage supplémentaire plus fragile.
- **Playwright / navigateur réel** — plus lourd ; hors micro-lot ; dépendances navigateur non nécessaires pour un smoke render.
- **jsdom** — pair classique, mais résolution npm cassée ici (peer optionnel `canvas` / bug arborist) ; happy-dom est l’alternative documentée par Vitest.
- **`@vitejs/plugin-react`** — ERESOLVE avec `@babel/core` via `shadcn` ; oxc JSX (Vite/Vitest) suffit pour les tests.
