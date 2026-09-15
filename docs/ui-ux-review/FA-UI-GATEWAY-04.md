# FA-UI-GATEWAY-04 — Gateway et guide

Lot d’implémentation sur `feature/FA-UI-BRAND-01` (pas de nouvelle branche).

## Objectif livré

Refondre l’expérience **Gateway** et le **guide** associé : Ferry Agent reste une **webapp cloud** ; seul le Gateway est local/self-hosted (téléchargements torrent, liaison sources locales / Prowlarr). Prowlarr n’est plus le centre de navigation — uniquement glossaire et dépannage.

## Comportements

- Intro cloud / local avec `CloudGatewayIllustration` et légendes HTML traduites.
- États : jamais configuré, indisponible, connecté, déconnecté (+ hint bibliothèque toujours utilisable), code expiré, révoqué, activité vide ≠ indisponible, téléchargement en cours / succès / échec / résultat incertain.
- Soft-refresh : échec d’actualisation sans vider la liste connue.
- Codes : affichage unique préservé ; copie vérifiée (`copyTextToClipboard`) ; bloc sélectionnable si échec.
- Guide : parcours « commencer en ligne » vs « installer le Gateway » ; **lien `.tar` unique retiré** (404 confirmé sur `/bundle/ferry-agent-gateway.tar`) ; étape téléchargement présentée comme non confirmée depuis la page, sans URL inventée.
- Cartes sous `lg`, table à partir de `lg` ; dates via locale app ; focus Annuler sur dialogs destructifs.

## Fichiers principaux

- `web/components/app/gateways/*`, `web/components/docs/byo-install-guide.tsx`
- `web/messages/fr.json`, `en.json`
- Tests : `gateways-state.test.ts` (`npm run test:gateways`)

## Preuves / limites

- Contrôles : `check:i18n`, eslint fichiers du lot, `lint`, `build`, `test:gateways`, `git diff --check`.
- **Aucun rendu navigateur** validé si le navigateur n’est pas disponible dans la session.
- Aucune connexion / installation réelle de Gateway pour tester.
- Disponibilité réelle des archives par architecture (GitHub Releases) **non certifiée** ici — l’étape 2 du guide le dit explicitement.
