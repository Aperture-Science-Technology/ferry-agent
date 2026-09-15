# FA-UI-SOURCES-SETTINGS-05 — Sources et Réglages

Lot d’implémentation sur `feature/FA-UI-BRAND-01` (pas de nouvelle branche).

## Objectif livré

Refondre **Sources** et **Réglages** en harmonie avec Bibliothèque / Envois / Appareils / Gateway. Ferry Agent reste une **webapp cloud** ; le Gateway local est une intégration séparée. Prowlarr n’apparaît que comme note contextuelle sur la source Gateway — pas comme navigation principale.

## Comportements

### Sources

- Lieu principal de gestion : deux groupes (« accès libre » / « fichiers et sources locales »).
- Gutenberg / Standard Ebooks : badge d’état + switch nommé ; attente par ligne ; échec de switch sans faux état (liste précédente conservée) + alerte persistante.
- Source absente du payload ou liste indisponible → **état inconnu**, jamais « activée » inventée (T10).
- Import : toujours disponible, lien vers la bibliothèque (pas de switch artificiel).
- Gateway : dépendance au module local expliquée ; lien vers Gateway ; pas d’affirmation « connecté » depuis le type de source.

### Réglages

- Préférences d’envoi seulement (email compte lecture seule, email Kindle, format) ; sauvegarde explicite ; dirty state ; erreur persistante ; `null` si email effacé.
- Renvoi clair vers Sources (plus de duplication de `SourcesManager`).
- Catalogue liseuse : guide, liens, création one-time, copie vérifiée, QR loading ≠ erreur, révocation avec focus Annuler.
- Pas de jauge quota (contrat `UserOut` sans usage/plafond).
- Dates catalogue via locale app ; cartes sous `lg`, table à partir de `lg`.

## Fichiers principaux

- `web/components/app/sources/*`, `web/components/app/settings/*`
- `web/app/[locale]/app/sources/page.tsx`, `web/app/[locale]/app/reglages/page.tsx`
- `web/messages/fr.json`, `en.json`
- Tests : `sources-state.test.ts`, `settings-state.test.ts` (`npm run test:sources-settings`)

## Preuves / limites

- Contrôles : `check:i18n`, eslint fichiers du lot, `lint`, `build`, `test:sources-settings`, `git diff --check`.
- **Aucun rendu navigateur** validé si le navigateur n’est pas disponible dans la session.
- Aucune action destructive réelle ni modification de compte utilisateur pour tester.
- Compatibilité réelle liseuse / scan QR **non certifiée** ici.
