# Changelog

## FA-DEVICE-DELIVERY-01

- PocketBook et les autres liseuses du tier D disposent d’un catalogue OPDS ; le tier C peut aussi choisir ce mode. Les liens sont réutilisés par nom de liseuse, chiffrés avec la clé Fernet existante, et retirés du suivi après révocation. Un ancien accès conservé uniquement sous forme d’empreinte doit être révoqué explicitement avant de pouvoir retrouver un nouveau lien.
- Test réel de l’adresse Kindle depuis les réglages du compte ou de la liseuse, avec domaines autorisés et quota partagé avec les livraisons. Un test accepté ne confirme pas sa réception par Amazon.
- Recherche sans distinction de casse ou d’accents, filtres et pagination serveur de l’historique ; relance des échecs et annulation des envois en attente, protégées contre les envois déjà commencés. Outils MCP correspondants.
- État du système dans les Réglages : conversion, email, espace utilisé, connexions personnelles et livraisons récentes.
- Nettoyage borné et journalisé des données d’indexeur dans les tâches terminées avant suppression.
- Révision 0019 additive et idempotente : enum OPDS en AUTOCOMMIT, extension unaccent, secrets OPDS chiffrés, référence privée du catalogue et réservations de quota des tests. Le retour arrière conserve ces ajouts.


All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Volumes library/tmp** — one-shot Compose `volume-init` (+ `deploy.sh`) passe `ferry_library` / `ferry_tmp` en UID/GID 10001 sans wipe ; évite `PermissionError` sous core non-root (ADR 0008).
- **MCP OAuth state** — volume nommé `ferry_mcp_oauth` monté sur
  `/home/appuser/.local/share/fastmcp` : les clients ne doivent plus se
  réauthentifier à chaque redéploiement du conteneur.
- **Découverte OIDC** — Traefik route `/.well-known/openid-configuration`
  vers le MCP (plus de 307 Next.js).
- **CORS `/mcp`** — `OPTIONS` répond via `CORSMiddleware` Starlette
  (FastMCP 4) ; défaut `MCP_ALLOWED_ORIGINS=*` sans credentials.

### Added

- **FA-SEARCH-QUERY-01** — Filtres, tri et pagination de la recherche, transmis aux gateways et au MCP ; critères partageables dans l’URL de la bibliothèque.

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

### Changed

- **FA-W02** — Migration 0009 : FK `ondelete` + `item_title` / `item_author` (delete books / devices sans 500).
- **FA-W03** — Plus de tokens OAuth cloud exposés au client (`cloud_linked` / `cloud_provider` uniquement).
- **FA-W04** — Fermeture du fallback compte-service MCP : suppression `MCP_API_KEY`, auth Clerk obligatoire.
- **FA-W09** — Champs effaçables sur books / users (`exclude_unset` seul) ; `EmailStr` + `default_format` validés.
- **FA-W10** — Fusion `deploy.yml` dans `ci.yml` (`needs` tests / lint) ; tests MCP + intégrations + ruff + pip-audit.
- **FA-W13** — Alignement types TS (`source_ref` / `cloud_provider` / delivery) + Select de format ; `DeliveryCreate.format` Literal (422).
- **FA-W14** — Images core / MCP sur `python:3.13-slim`, USER non-root, HEALTHCHECK `/healthz`, deps pinnées, compose `service_healthy`.
- **FA-UI-POLISH-05** — Finition UI : header plus opaque au scroll (verre dépoli), hero sans logo / pastille / halo gris avec aperçu démo teinté bleu, cartes liseuse contrastées (marques réelles, aperçus unifiés), guide sans illustration à glossaire développé, encarts « C'est bon quand », logos Windows / macOS, commandes terminal pas à pas, pages d'authentification réalignées et `/sign-up` en page « sur invitation » (inscriptions Clerk toujours fermées).

### Security

- **FA-W07** — Untrack `web/.clerk/keyless.json` + job CI gitleaks (scan historique, allowlist claimToken révoqué).
- **FA-W15 — Breaking (opérateurs / installations existantes)** : RPC Transmission fermé par défaut — bind `127.0.0.1`, **authentification obligatoire**, mot de passe généré et persisté sous `/config`. Les installs qui publiaient le RPC sans auth doivent récupérer le mot de passe au démarrage (ou dans `/config`) et mettre à jour leurs clients.
- **FA-W16 — Breaking (opérateurs / installations existantes)** : auth Prowlarr Forms obligatoire, utilisateur `ferry` généré et persisté ; port `9696` lié à `127.0.0.1` par défaut. Les installs qui exposaient Prowlarr sans auth / sur toutes les interfaces doivent se reconnecter avec les identifiants générés et revoir la publication du port.
