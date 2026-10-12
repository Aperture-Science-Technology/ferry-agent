# Ferry Agent

Core backend du « pont ebooks multi-liseuses » Ferry Agent : recherche sur des
sources légales (Project Gutenberg, Standard Ebooks), upload utilisateur,
conversion de formats, et mise en file de livraisons vers des liseuses
(Kindle, Kobo, Tolino, PocketBook...).

La recherche accepte des filtres serveur (langue, format, auteur, provenance,
déjà possédé, partageurs minimum, taille), un tri et une pagination —
`POST /api/v1/books/search`. Les mêmes critères sont exposés à l'outil MCP
`search_library` et transmis aux gateways.

La livraison suit le tier de l'appareil : **A** email Send-to-Kindle, **B**
dépôt cloud Dropbox/Google Drive, **C** code court lu dans le navigateur de la
liseuse, **D** accès au **catalogue OPDS** — les liseuses à lecteur OPDS natif
(PocketBook, Kobo d'entrée de gamme, Tolino) reçoivent un lien de catalogue
réutilisable et révocable.

Le périmètre **M0.5** ajoute le peering avec un connecteur torrent détaché :
ce core ne télécharge aucun torrent. Il orchestre des `GatewayJob` et reçoit
les résultats/fichiers d'un bundle BYO installé chez l'utilisateur.

## Démarrage

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# éditer .env : DATABASE_URL vers un Postgres, CLERK_ISSUER si Clerk est configuré

alembic upgrade head
uvicorn ferry_agent.main:app --reload
```

Sans `CLERK_ISSUER` configuré, l'API tourne en **mode dev** : l'auth accepte
un header `X-Dev-User: <email>` à la place d'un JWT Clerk. Ce mode ne doit
jamais être actif en production.

`GET /health` et `GET /healthz` sont publics et ne nécessitent pas de DB.

## Gateway détaché

Le dashboard crée une gateway avec `POST /api/v1/gateways`. Le pairing token
et la clé gateway ne sont renvoyés qu'à cette occasion. Le bundle consomme
ensuite `/pair`, `/poll` et les routes de résultat avec `X-Gateway-Key`.

Paramètres importants : `PAIRING_TOKEN_TTL_MINUTES`,
`GATEWAY_ONLINE_SECONDS`, `GATEWAY_SEARCH_WAIT_SECONDS`,
`MAX_FETCH_BYTES` et, facultativement, `VIRUSTOTAL_API_KEY`.

## Envoi vers Kindle (SMTP)

Pour activer la livraison par email (Send-to-Kindle) :

1. Renseigner dans `.env` : `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURITY`,
   `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (et optionnellement
   `SMTP_REPLY_TO`). Un `SMTP_USER` / `SMTP_PASSWORD` vide désactive
   l'envoi sans faire planter l'app.
2. Vérifier le domaine d'envoi chez le fournisseur (SPF, DKIM, DMARC) —
   l'expéditeur (`SMTP_FROM`) doit être sur ce domaine.
3. Faire approuver cette adresse d'expéditeur dans le compte Amazon de
   chaque utilisateur (liste des documents personnels).

Voir [ADR 0010](docs/adr/0010-envoi-email-resend-send-to-kindle.md) pour le
raisonnement (Relais Resend, statut `sent`, formats, quotas).

`GET /api/v1/mail/settings` expose l'adresse d'envoi, le domaine et les
domaines de destinataire acceptés ; `POST /api/v1/mail/test` envoie un message
de test réel sous la même politique de domaine et le même quota que les
livraisons. Un test accepté ne confirme pas sa réception par Amazon.

## Livraison et exploitation

- `GET /api/v1/deliveries` — historique paginé et filtrable (`q`, `status`,
  `device_id`, `page`, `limit`), recherche insensible à la casse et aux accents.
- `POST /api/v1/deliveries/{id}/retry` — relance une livraison **en échec**.
- `POST /api/v1/deliveries/{id}/cancel` — annule une livraison **en attente**.
  Les deux refusent les autres états en `409` avec un message actionnable, et un
  verrou par tâche empêche une annulation de courir contre un envoi commencé.
- `GET /api/v1/system/health` — état vérifiable limité à l'utilisateur courant :
  conversion, email, espace utilisé et quota, connexions personnelles,
  livraisons récentes. Ni secret, ni adresse interne.
- Les tâches gateway terminées sont **assainies** (URL d'indexeur, GUID et
  identifiants retirés) avant leur purge, sans attendre la rétention.

## Catalogue OPDS

Le catalogue sortant (`/opds/{jeton}/...`) sert liseuses et lecteurs OPDS :
racine, `/all`, `/recent`, `/authors`, `/author`, `/search`, `opensearch.xml`,
`/download/{item_id}`, `/cover/{item_id}`. Jeton haché porté dans le chemin,
`404` si inconnu ou révoqué, limitation à 120 requêtes par minute et par IP.
Voir [ADR 0017](docs/adr/0017-livraison-catalogue-opds.md).

## Structure

```
src/ferry_agent/
  main.py           app FastAPI (lifespan, routers)
  config.py         configuration (pydantic-settings)
  db.py             engine/session SQLAlchemy async
  models.py         modèles SQLAlchemy (User, Device, Source, LibraryItem, DeliveryJob, Gateway, GatewayJob)
  schemas.py        schémas Pydantic
  api/              routes FastAPI (health, books, devices, deliveries, gateways, system, opds, tierc, mail, sources, users) + dépendances d'auth
  services/         conversion, import de bibliothèque, livraison par tier, OPDS, gateways, politique d'envoi
  connectors/       connecteurs de sources légales (gutenberg, standard_ebooks, upload) + registry
web/                tableau de bord Next.js (FR/EN) ; `web/harness/` couvre le rendu jsdom et `web/harness/browser/` mesure le rendu réel
mcp-server/         surface MCP (38 outils) au-dessus de l'API REST
gateway/            agent et image du bundle BYO (Prowlarr, Transmission, watcher, VirusTotal)
```

## Conversion de formats

`services/converters.py` détecte `ebook-convert` (Calibre) au démarrage. S'il
est disponible, il est utilisé pour EPUB→MOBI/AZW3 ; sinon, ces conversions
retombent sur PyMuPDF (export PDF). EPUB→PDF utilise toujours PyMuPDF.

## Tests

```bash
pytest -q                    # tests unitaires (ni base ni Calibre requis)
pytest tests/integration -q  # base Postgres jetable, fournie par TEST_DATABASE_URL
```

Le harnais d'intégration **saute silencieusement** si Postgres est injoignable :
toujours exiger le décompte des tests passés, jamais un « quelques ignorés ».

Le web se vérifie ainsi :

```bash
cd web && npm run check:i18n && npm run lint && npx tsc --noEmit
cd web && npx vitest run --config vitest.config.mts   # harnais de rendu jsdom
cd web && npm run build
```

Le harnais navigateur (`web/harness/browser/`) mesure le rendu réel aux paliers
320 / 390 / 768 / 1024 / 1280 px ; il utilise le Playwright déjà présent sur la
machine. Les captures produites sont des preuves de recette et ne sont pas
versionnées.

## Développement et déploiement

Le flux unique — GitFlow, délégation à un agent de code, portes de validation,
promotion en production (images GHCR, Watchtower, `deploy.sh`) et nettoyage
contrôlé — est décrit dans
[docs/DEVELOPMENT-AND-DEPLOYMENT.md](docs/DEVELOPMENT-AND-DEPLOYMENT.md).

## Serveur MCP

Le service `mcp-server` expose le protocole MCP (2026-07-28) sous `/mcp`,
avec OAuth Clerk (PKCE S256, consentement, introspection). Voir
[ADR 0011](docs/adr/0011-authentification-mcp.md).

### Parcours côté client (outils)

1. **Kindle de bout en bout** — `list_devices` / `add_device`, puis
   `get_mail_settings` pour l'adresse d'envoi à **approuver chez Amazon**
   (Documents personnels). `deliver_to_kindle(item_id, …, confirm=True)` ou
   `plan_delivery` / `diagnose` en dry-run. Statut `sent` = accepté par le
   relais email, **pas** « livré sur la liseuse » : Amazon ne renvoie aucun
   rebond si l'expéditeur n'est pas approuvé.
2. **Gateways** — `create_gateway` (secrets affichés une fois), pairing du
   bundle, `list_gateways` / `list_gateway_jobs` / `get_gateway_job`.
3. **Bibliothèque** — `search_library` (filtres `language`, `formats`,
   `author`, `sources`, `owned`, `min_seeders`, `max_size_bytes`, plus `sort`
   et `limit`) → `add_to_library` → `list_library` / `search_library_items` ;
   `download_library_item` renvoie un lien signé (TTL **15 min**).
4. **Livraisons** — `deliver`, `list_deliveries` (pagination, recherche,
   filtre par statut), `get_delivery_status`, et `retry_delivery` /
   `cancel_delivery` pour relancer un échec ou annuler un envoi en attente.
5. **OPDS** — `create_opds_token` (secret une fois + URL catalogue) /
   `revoke_opds_token` / `list_opds_tokens`.

La surface compte **38 outils**. Comme le conteneur démarre par
`python -m ferry_mcp.server`, tout outil doit être déclaré **avant** le bloc
`if __name__ == "__main__":` — un outil défini après n'est jamais enregistré
en production, et un test dédié exécute réellement ce chemin pour l'attraper.

Variables d'opérateur utiles : `MCP_JWT_SIGNING_KEY`,
`MCP_CORE_ASSERTION_PRIVATE_KEY_B64` (MCP), `MCP_ASSERTION_PUBLIC_KEY_B64`
(cœur), volume `ferry_mcp_oauth` pour l'état OAuth.
