# FA-UI-FINAL-06 — Convergence UI et préparation release

Lot d’implémentation sur `feature/FA-UI-BRAND-01` (pas de nouvelle branche).

## Objectif livré

Passe finale de convergence : tous les écrans app (Bibliothèque, Envois, Appareils, Gateway, Sources, Réglages) + coque (dialog/sheet/sidebar) partagent les mêmes patterns de titres, breakpoints table/cartes (`lg`), dates via locale app, labels accessibles FR/EN, et lint vert sans contournement.

## Correctifs

- Lint `react-hooks/set-state-in-effect` : `cover-image.tsx` (reset pendant le render) ; `use-gateway-job.ts` (vue dérivée via `resolveGatewayJobView`, plus de reset synchrone dans l’effet).
- Bibliothèque : cartes/tables alignées sur `lg` comme Envois/Appareils/Gateway ; dates `Intl` + locale app ; tirets via `common.dash` ; mode d’envoi du détail livre traduit (plus de `job.method` brut).
- Coque : `common.close`, `common.toggleSidebar`, `common.sidebar`, `common.sidebarDescription` branchés sur dialog / sheet / sidebar.

## Preuves / limites

- Contrôles : scripts `test:*` déclarés, `check:i18n`, `lint`, `build`, `git diff --check`.
- **Aucun rendu navigateur** validé si Hermes / navigateur ne peut pas joindre le serveur local — checklist manuelle obligatoire.
- Aucune action réelle (envoi, OAuth, Gateway, révocation) sur compte utilisateur.
- CI distante non affirmée ici ; verdict local uniquement.
