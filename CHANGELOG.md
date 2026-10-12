# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **FA-ECOSYSTEM-01 — information gateway** — L'agent annonce sa version (`X-Gateway-Version`) à chaque interrogation ; le cœur la conserve et l'interface la compare à celle du serveur, en rappelant que la mise à jour passe par le retéléchargement puis la réimportation de l'archive. Sans en-tête, la valeur connue reste inchangée.
- **FA-ECOSYSTEM-01 — MCP : ressources et prompt** — Ressources en lecture `library://items` (et sa variante paginée) et `devices://list`, plus un prompt `parcours-kindle` décrivant la séquence correcte. Ajouts seuls : aucun outil existant n'a changé de nom ni de signature.
- **FA-ECOSYSTEM-01 — OPDS durci** — Mot de passe Basic accepté en plus du jeton dans le chemin ; quota de téléchargements et date d'expiration par jeton, vérifiés à chaque accès et incrémentés au téléchargement. Un jeton inconnu, expiré, révoqué ou épuisé reste **404**, jamais 403 (mig 0020).
- **FA-ECOSYSTEM-01 — sources externes** — Open Library et Internet Archive rejoignent les sources cherchables : Open Library ne retient que les œuvres réellement téléchargeables (`ia` et `public_scan_b`) ; Internet Archive ne retient que les textes du domaine public librement téléchargeables, le prêt contrôlé étant exclu. Échec réseau avalé en liste vide, comme les connecteurs existants (mig 0020).
- **FA-SEARCH-QUERY-01** — Filtres, tri et pagination de la recherche (`filters`, `sort`, `limit`, `offset`), transmis à la charge utile des gateways et à l'outil MCP `search_library` ; critères partageables dans l'URL de la bibliothèque. Réponse `list[ResultOut]` conservée (ADR 0016).
- **FA-DEVICE-DELIVERY-01 — catalogue OPDS** — Les liseuses du tier D (PocketBook, « autre ») ne sont plus un cul-de-sac : elles disposent d'un accès catalogue OPDS, que le tier C peut aussi choisir. PocketBook est traité explicitement. Le lien est réutilisé par nom de liseuse sous verrou de ligne, chiffré avec la clé Fernet existante ; après révocation, un ancien accès réduit à son empreinte doit être révoqué explicitement avant de retrouver un lien (ADR 0017).
- **FA-DEVICE-DELIVERY-01 — santé de l'adresse Kindle** — `GET /mail/settings` expose le domaine d'envoi et la liste des domaines acceptés ; `POST /mail/test` envoie un message réel sous la même politique de domaine et le même quota que les livraisons. Un test accepté ne confirme pas sa réception par Amazon.
- **FA-DEVICE-DELIVERY-01 — exploitation des livraisons** — Recherche sans distinction de casse ni d'accents, filtre par statut et par liseuse, pagination serveur ; relance d'un échec et annulation d'un envoi en attente, protégées par un verrou par tâche contre les envois déjà commencés (409 actionnable hors des cas autorisés). Outils MCP `retry_delivery` et `cancel_delivery`, enregistrés avant le point d'entrée avec un test qui exécute réellement le chemin `__main__` (ADR 0018).
- **FA-DEVICE-DELIVERY-01 — état du système** — `GET /api/v1/system/health` : conversion, email, espace utilisé et quota, connexions personnelles, livraisons récentes. Faits vérifiables, strictement limités à l'utilisateur, sans secret ni adresse interne. Panneau correspondant dans Réglages.
- **FA-UI-ENHANCE-01 — filtres communs** — Une barre unique (recherche, filtres, tri, compteur, critères retirables, remise à zéro, panneau mobile) est réutilisée sur la collection, les résultats de recherche, l'historique des livraisons et la liste des liseuses ; les critères et la pagination vivent dans l'URL.
- **FA-UI-ENHANCE-01 — actions en lot** — Sélection de plusieurs livres, livraison avec un choix unique de liseuse et de format, suppression confirmée et bilan des réussites et des échecs. Trois demandes au maximum sont traitées simultanément ; une demande acceptée ne signifie pas que le livre est arrivé.
- **FA-UI-ENHANCE-01 — palette de commandes** — Recherche et navigation rapide avec Ctrl/Cmd + K ou le bouton d'en-tête : pages, ajout de livres et de liseuses, accès Gateway, nouveaux codes et détails des livres. Focus piégé puis restitué, navigation clavier complète, sans dépendance ajoutée.
- **FA-UI-ENHANCE-01 — quota, onboarding et tri** — Jauge d'espace utilisée dans Réglages (alerte au-delà de 90 %, d'après le quota réel du compte) ; accueil `/app` en quatre étapes guidées fondées sur les données du compte, masquage mémorisé par compte ; tri des liseuses et de la page de livraisons affichée, états vides avec une action pour poursuivre.
- **FA-UI-ENHANCE-01 — harnais navigateur** — `web/harness/browser` mesure le rendu réel : 41 contrôles de largeur et parcours clavier (Tab/Maj+Tab, Échap, restitution du focus) validés à 320, 390 et 1280 px. Les captures de recette restent hors du dépôt.
- **MCP lot 4 — assertion d'identité** — le MCP forge un JWT Ed25519 court
  (`iss=ferry-agent-mcp`, `aud=ferry-core`, TTL 120 s) après OAuth Clerk ;
  le cœur vérifie la clé publique (`MCP_ASSERTION_PUBLIC_KEY_B64`). ADR 0011.
- **MCP lot 4 — OAuth ops** — `MCP_JWT_SIGNING_KEY` dédiée ;
  `issuer_url` passé au `ClerkProvider` ; `required_scopes` pour
  `WWW-Authenticate scope="…"`.
- **MCP lots 1–3** — protocole 2026-07-28 / double ère ; outils bibliothèque,
  gateways, OPDS, téléchargement signé (15 min) ; parcours Kindle
  (`deliver_to_kindle`, `diagnose`, `plan_delivery`) et interprétation
  `sent` ≠ livré.
- **FA-W01** — Harnais de tests d'intégration Postgres réel + sync modèles / Alembic.
- **FA-W05** — Upload utilisateur borné (413) + sniff de format (422) ; contenu prioritaire sur l'extension ; traversal neutralisé.
- **FA-W06** — Purge périodique des `GatewayJob` terminés et `ShortCode` expirés (tâche lifespan).
- **FA-W08** — Chemins temp uniques sous `settings.temp_dir` (`mkstemp`) ; validation stricte `result_id` ; cleanup des dérivés de conversion.
- **FA-W11** — `DeliveryOut` enrichi (`item_title` / `item_author` / `device_label`) + page Livraisons lisible.
- **FA-W12** — Sources par défaut à la création utilisateur + backfill idempotent + contrainte `UNIQUE(user_id, type)` (mig 0011).
- **FA-W17** — File de jobs anti-poison : `attempts` / backoff exponentiel / dead-letter sur `GatewayJob` (mig 0010).
- **FA-W18** — Suivi UI des jobs gateway (hook 3 s, badges récupération, activité récente, `GET /gateways/{id}/jobs`).
- **FA-W19** — Suite de tests gateway agent (pairing / resolve / fetch / search) + job CI `gateway-tests`.
- **FA-W20** — Chaîne release distribution : tarballs docker-format par arch (tags `v*`), SHA256SUMS + cosign, `dist/` + `install.sh`, sync `/bundle`.
- **FA-W21** — Canal homelab C3 : compose exige `GATEWAY_KEY` avant création ; `install.sh` wait_for_pairing 60 s portable ; artefacts dist versionnés.
- **FA-W25** — Santé honnête = appairage : `healthcheck.sh` (ping + `state.json` + heartbeat frais) ; refus distinct PAIRING / GATEWAY_KEY.
- **FA-W26** — Calibre en prod (`calibre-bin` image core) ; plus de fallback silencieux ; `/healthz` expose la capacité de conversion.
- **FA-W27** — Profils de conversion par liseuse (presets 6″ / 7″+ / tablette) + cache dérivé TTL (mig 0012).
- **FA-W28** — Serveur OPDS 1.2 sortant (catalogue liseuse), jeton hashé + QR + révocation, rate limit, Traefik `/opds` (mig 0013).
- **FA-W29** — Upload utilisateur : `POST /books/upload`, dropzone XHR + progression, quota 5 Go, watcher agent `/watch`.
- **FA-W30** — Onboarding / suivi gateway : attente pending + countdown TTL, auto-refresh, pastille en ligne / hors ligne.
- **Documentation** — `docs/DEVELOPMENT-AND-DEPLOYMENT.md` rejoint le dépôt : flux unique de développement et de déploiement (GitFlow, délégation, portes de validation, promotion en production, nettoyage contrôlé).

### Changed

- **FA-DEVICE-DELIVERY-01 — révision 0019** — additive et idempotente : valeur d'énumération `opds` posée en AUTOCOMMIT (Postgres refuse l'usage d'une valeur ajoutée dans la même transaction), extension `unaccent`, secrets OPDS chiffrés, référence privée du catalogue sur les tâches, réservations de quota des tests d'envoi. Le retour arrière conserve ces ajouts : Postgres ne sait pas retirer une valeur d'énumération.
- **FA-DEVICE-DELIVERY-01 — purge des tâches gateway** — Les URL d'indexeur, GUID et identifiants sont retirés de la charge utile avant suppression, par lots bornés et sous `FOR UPDATE SKIP LOCKED`, au lieu d'attendre l'expiration de la rétention.
- **FA-UI-ENHANCE-01** — `library-filters.tsx` est absorbé par le composant commun et un fichier de configuration des critères ; la structure d'en-tête est conservée, avec un bouton de palette et une hauteur mobile adaptée pour éviter le chevauchement des actions.
- **FA-W02** — Migration 0009 : FK `ondelete` + `item_title` / `item_author` (delete books / devices sans 500).
- **FA-W03** — Plus de tokens OAuth cloud exposés au client (`cloud_linked` / `cloud_provider` uniquement).
- **FA-W04** — Fermeture du fallback compte-service MCP : suppression `MCP_API_KEY`, auth Clerk obligatoire.
- **FA-W09** — Champs effaçables sur books / users (`exclude_unset` seul) ; `EmailStr` + `default_format` validés.
- **FA-W10** — Fusion `deploy.yml` dans `ci.yml` (`needs` tests / lint) ; tests MCP + intégrations + ruff + pip-audit.
- **FA-W13** — Alignement types TS (`source_ref` / `cloud_provider` / delivery) + Select de format ; `DeliveryCreate.format` Literal (422).
- **FA-W14** — Images core / MCP sur `python:3.13-slim`, USER non-root, HEALTHCHECK `/healthz`, deps pinnées, compose `service_healthy`.
- **FA-UI-POLISH-05** — Finition UI : header plus opaque au scroll (verre dépoli), hero sans logo / pastille / halo gris avec aperçu démo teinté bleu, cartes liseuse contrastées (marques réelles, aperçus unifiés), guide sans illustration à glossaire développé, encarts « C'est bon quand », logos Windows / macOS, commandes terminal pas à pas, pages d'authentification réalignées et `/sign-up` en page « sur invitation » (inscriptions Clerk toujours fermées).

### Fixed

- **Volumes library/tmp** — one-shot Compose `volume-init` (+ `deploy.sh`) passe `ferry_library` / `ferry_tmp` en UID/GID 10001 sans wipe ; évite `PermissionError` sous core non-root (ADR 0008).
- **MCP OAuth state** — volume nommé `ferry_mcp_oauth` monté sur
  `/home/appuser/.local/share/fastmcp` : les clients ne doivent plus se
  réauthentifier à chaque redéploiement du conteneur.
- **Découverte OIDC** — Traefik route `/.well-known/openid-configuration`
  vers le MCP (plus de 307 Next.js).
- **CORS `/mcp`** — `OPTIONS` répond via `CORSMiddleware` Starlette
  (FastMCP 4) ; défaut `MCP_ALLOWED_ORIGINS=*` sans credentials.

### Security

- **FA-W07** — Untrack `web/.clerk/keyless.json` + job CI gitleaks (scan historique, allowlist claimToken révoqué).
- **FA-W15 — Breaking (opérateurs / installations existantes)** : RPC Transmission fermé par défaut — bind `127.0.0.1`, **authentification obligatoire**, mot de passe généré et persisté sous `/config`. Les installs qui publiaient le RPC sans auth doivent récupérer le mot de passe au démarrage (ou dans `/config`) et mettre à jour leurs clients.
- **FA-W16 — Breaking (opérateurs / installations existantes)** : auth Prowlarr Forms obligatoire, utilisateur `ferry` généré et persisté ; port `9696` lié à `127.0.0.1` par défaut. Les installs qui exposaient Prowlarr sans auth / sur toutes les interfaces doivent se reconnecter avec les identifiants générés et revoir la publication du port.
