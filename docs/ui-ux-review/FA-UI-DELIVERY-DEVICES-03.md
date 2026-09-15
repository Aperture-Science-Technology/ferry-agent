# FA-UI-DELIVERY-DEVICES-03 — Livraisons et Appareils

Lot d’implémentation sur `feature/FA-UI-BRAND-01` (pas de nouvelle branche).

## Objectif livré

Refondre les écrans **Envois** et **Appareils** en harmonie avec l’identité Ferry Agent et les patterns de la Bibliothèque : suivi lisible, états non trompeurs, destinations claires. Ferry Agent reste une **webapp cloud** ; le Gateway n’est pas le centre de ces écrans.

## Comportements

### Envois

- Actualisation explicite ; polling borné (5 s, max 5 min) tant qu’il reste des envois `queued` / `sent`.
- Échec de chargement distinct d’une liste vide ; échec d’actualisation sans vider les envois connus.
- Statuts : demandé / en cours / terminé / échoué / inconnu ; hint « terminé » sans promesse de lecture sur liseuse.
- Liste et détail cohérents (`seedJob` + callback) ; reprise sur erreur de détail.
- Cartes compactes sous `lg`, table à partir de `lg` (sidebar) ; action **Suivre** explicite (pas de carte-bouton).

### Appareils

- Création / édition / suppression avec labels associés ; confirmation destructive nommée ; focus initial sur Annuler.
- Soft-refresh après OAuth : liste conservée ; erreur ≠ vide.
- Liaison cloud : ouverture, attente autre fenêtre, popup bloquée, résultat incertain ; protocole OAuth inchangé (popup, `window.opener`, same-origin, `cloud_link`, polling).

## Fichiers principaux

- `web/components/app/deliveries/*`, `web/components/app/devices/*`
- `web/messages/fr.json`, `en.json`
- Tests : `deliveries-state.test.ts`, `devices-state.test.ts` (`npm run test:delivery-devices`)

## Preuves / limites

- Contrôles : `check:i18n`, eslint fichiers du lot, `lint`, `build`, `test:delivery-devices`, `git diff --check`.
- **Aucun rendu navigateur** validé si le navigateur n’est pas disponible dans la session.
- Aucune livraison, suppression ou liaison réelle sur un compte utilisateur pour tester.
- Disponibilité réelle Dropbox/Drive non certifiée ici (bouton ≠ config fournisseur opérationnelle).
