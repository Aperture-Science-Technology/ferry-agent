# Ferry Agent

Core backend du « pont ebooks multi-liseuses » Ferry Agent : recherche sur des
sources légales (Project Gutenberg, Standard Ebooks), upload utilisateur,
conversion de formats, et mise en file de livraisons vers des liseuses
(Kindle, Kobo, Tolino, PocketBook...).

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

## Structure

```
src/ferry_agent/
  main.py           app FastAPI (lifespan, routers)
  config.py         configuration (pydantic-settings)
  db.py             engine/session SQLAlchemy async
  models.py         modèles SQLAlchemy (User, Device, Source, LibraryItem, DeliveryJob, Gateway, GatewayJob)
  schemas.py        schémas Pydantic
  api/              routes FastAPI (health, books, devices, deliveries, gateways) + dépendances d'auth
  services/         conversion de formats, import de bibliothèque
  connectors/       connecteurs de sources légales (gutenberg, standard_ebooks, upload) + registry
```

## Conversion de formats

`services/converters.py` détecte `ebook-convert` (Calibre) au démarrage. S'il
est disponible, il est utilisé pour EPUB→MOBI/AZW3 ; sinon, ces conversions
retombent sur PyMuPDF (export PDF). EPUB→PDF utilise toujours PyMuPDF.

## Tests

```bash
pytest -q
```

Les tests ne nécessitent ni base de données ni Calibre installés.
