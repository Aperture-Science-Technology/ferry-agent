# ADR 0013 — Retours OAuth fixes par fournisseur

- **Statut** : accepté
- **Date** : 2026-10-04
- **Ticket** : FA-F08-CLOUD-CALLBACK-01

## Contexte

Les URI de retour OAuth contenaient l'identifiant de chaque liseuse. Dropbox
et Google demandent une URI enregistrée exactement : cette configuration
imposait donc un enregistrement par appareil.

## Décision

Les retours publics sont fixes :

- `https://ferry-agent.aperture-agency.org/api/v1/devices/link/callback/dropbox`
- `https://ferry-agent.aperture-agency.org/api/v1/devices/link/callback/google`

Le `state` signé restitue l'appareil, le fournisseur et la langue. Sa signature,
son expiration et son usage unique côté serveur restent obligatoires. Le
fournisseur du chemin doit correspondre au fournisseur signé (`drive` pour Google).
Les retours GET partagent leur traitement et redirigent vers le dashboard en
cas de succès comme d'échec, sans authentification Clerk.

## Conséquences

Les routes GET et POST historiques restent disponibles. Les configurations
contenant encore `{id}` sont substituées à l'autorisation comme à l'échange ;
une URI fixe reste inchangée. Les environnements existants doivent remplacer
leurs anciennes valeurs par les URI ci-dessus et enregistrer ces valeurs chez
les fournisseurs. Le départ `/devices/link/start` accepte `device_id` en paramètre ;
le départ historique `/devices/{device_id}/link` reste disponible.

Google demande `https://www.googleapis.com/auth/drive.file`. La requête Dropbox
n'envoie pas de paramètre `scope` : ce correctif ne modifie pas les permissions
configurées dans la console Dropbox. Les deux flux demandent un accès hors ligne.

## Alternatives écartées

- Une URI par liseuse : impose un enregistrement préalable de chaque appareil.
- Un identifiant d'appareil non signé : ne constitue pas une preuve de liaison.
- Supprimer les anciennes routes : rompt la compatibilité des clients existants.
