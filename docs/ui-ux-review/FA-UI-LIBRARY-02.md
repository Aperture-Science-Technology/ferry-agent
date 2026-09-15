# FA-UI-LIBRARY-02 — Bibliothèque pilote

Lot d’implémentation sur `feature/FA-UI-BRAND-01` (pas de nouvelle branche).

## Objectif livré

Faire de la Bibliothèque le premier écran refondu avec le brand kit : collection personnelle d’abord, ajout/import et recherche sources distincts, états de données non trompeurs, patterns réutilisables (`EmptyState.visual`, helpers de pagination).

## Preuves / limites

- Contrôles demandés : i18n, eslint fichiers touchés, lint, build, `git diff --check`, test Node `mergeLibraryFetch` (pagination partielle ≠ vide).
- **Aucun rendu navigateur** validé dans la session d’implémentation si le navigateur n’est pas disponible.
- Aucune livraison ni suppression réelle sur un compte utilisateur pour tester.
