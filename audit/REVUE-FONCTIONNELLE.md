# Revue fonctionnelle Ferry Agent — FA-AUDIT-MCP-FULL-01

Date : 3 octobre 2026. Dépôt audité : `/home/glados/projects/ferry-agent-gwfix` (chemin physique `/mnt/HC_Volume_106803131/projects/ferry-agent-gwfix`). Branche et base `7759bf69` : informations fournies par le commanditaire, non vérifiées par git. Aucune commande git, aucune correction du produit. Seul `audit/` a été écrit dans le dépôt.

## 1. Périmètre et valeur des verdicts

**36 outils MCP et 55 opérations HTTP, sur 44 chemins OpenAPI, ont été examinés.** Aucun appel MCP ne vise une méthode ou un chemin absent. Cela ne suffit pas à garantir le résultat métier : huit défauts sont détaillés plus bas.

**OK** signifie que le contrat et le scénario précisé sont vérifiés, pas que tous les cas possibles sont couverts. **DÉFAUT** indique une anomalie reproduite, y compris du contrat publié ; le scénario nominal peut fonctionner. **NON VÉRIFIABLE** signifie que la preuve positive manque, même lorsqu’un rejet HTTP attendu a été obtenu. Les succès de formatage et de corps HTTP MCP ne valent pas validation OAuth depuis Claude/ChatGPT.

Authentification : assertion Ed25519, iss=ferry-agent-mcp, aud=ferry-core, sub=audit, email du compte dédié, TTL 240 s et jti aléatoire. Premier `GET /api/v1/users/me` : **200**, utilisateur `48c90f27-b635-42b0-9b89-73b21d345088`, email exact vérifié. Aucun jeton signé ni clé privée n’est fourni dans ce rapport.

Les trois contrats ont été comparés : `openapi.json`, OpenAPI généré par le code local, OpenAPI servi par le conteneur de production. **Ils sont identiques** (pas seulement leurs chemins). Le chemin public `/openapi.json` est routé vers le web (307 puis 404) ; le contrat déployé a donc été lu via HTTP sur `127.0.0.1:8000` à l’intérieur du conteneur, sans modification. Preuves : [openapi-code.json](openapi-code.json), [openapi-deployed.json](openapi-deployed.json), [openapi-diff.txt](openapi-diff.txt). `openapi-live.json` conserve la première réponse publique non JSON, pas un contrat exploitable.

Les preuves HTTP horodatées sont dans [http.jsonl](http.jsonl), avec corps de réponse expurgés. Les premiers essais sont reconstituables exactement via [lifecycle.py](lifecycle.py) ; les suivants enregistrent aussi les corps JSON envoyés. Les fonctions MCP ont en outre été appelées directement en Python, en remplaçant seulement la résolution d’identité et le client HTTP pour utiliser cette assertion : [wrappers.py](wrappers.py), [wrapper-results.jsonl](wrapper-results.jsonl), [wrapper-http.jsonl](wrapper-http.jsonl). Ce n’est pas un client MCP authentifié. Un verrou dans ce banc interdit tout POST de livraison.

## 2. Les 36 outils MCP

Chaque ligne vérifie chemin/méthode, corps, paramètres requis et lecture de réponse. Tous utilisent `Authorization: Bearer <assertion>` et `User-Agent: ferry-agent-mcp` ; httpx ajoute `Content-Type: application/json` aux corps JSON. Aucun en-tête métier requis oublié sur les routes utilisateur. Les détails exhaustifs des signatures, appels, paramètres et schémas requis sont dans [CONTRATS.md](CONTRATS.md), générés par [contract_inventory.py](contract_inventory.py).

| Outil | Endpoint(s) appelés, helpers inclus | Verdict | Preuve et couverture des paramètres |
|---|---|---|---|
| `search_library` | `POST /api/v1/books/search` | OK | query:str requis, scope:list[str] optionnel ; liste ResultOut correctement parcourue. Recherche légale et gateway : 200 ; titres et identifiants rendus. Métadonnées non affichées : F01 au prochain ajout. |
| `add_to_library` | `POST /api/v1/books` | DÉFAUT | source/result_id envoyés ; result impossible à fournir. 201 avec titre tmpmb414kk2 ; gateway 202 puis titre audit-reference : F01. Contrat du corps absent : F07. |
| `list_library` | `GET /api/v1/books` | OK | page/limit entiers envoyés ; items,total,page lus correctement (200, bibliothèque vide puis peuplée). q couvert par search_library_items ; limite API 200. |
| `list_devices` | `GET /api/v1/devices` | OK | Aucun paramètre requis ; liste DeviceOut (200), noms, marques, tier et état cloud rendus. |
| `list_device_methods` | `GET /api/v1/devices/{device_id}/methods` | OK | UUID de chemin fourni ; liste method/available/reason_code conforme, email disponible observé (200). |
| `deliver` | `POST /api/v1/deliveries`<br>`GET /api/v1/devices`<br>`GET /api/v1/devices/{device_id}/methods` | NON VÉRIFIABLE | Corps library_item_id/device_id/method + format conforme ; confirm=False testé sans POST. POST méthode indisponible : 400. Aucune livraison réelle effectuée dans cette passe. |
| `get_delivery_status` | `GET /api/v1/deliveries/{job_id}` | NON VÉRIFIABLE | job_id fourni, clés DeliveryOut correctes ; 404 observé sur UUID nul. Aucun job réel disponible ; le 404 ne valide pas la lecture positive. |
| `list_gateways` | `GET /api/v1/gateways` | OK | Liste GatewayOut 200 ; gateway_id/status/last_seen_at conformes. Paramètres de durée non affichés mais utilisés par le web. |
| `get_gateway_job` | `GET /api/v1/gateways/jobs/{job_id}` | OK | job_id fourni ; 200 sur fetch pending puis done avec library_item_id ; 200 sur search done. Clés conformes. |
| `list_sources` | `GET /api/v1/sources` | OK | Liste SourceOut 200 ; type/enabled/id conformes, created_at volontairement non affiché. |
| `get_profile` | `GET /api/v1/users/me` | OK | UserOut 200 ; les quatre champs métier retournés correctement. |
| `get_mail_settings` | `GET /api/v1/mail/settings` | OK | MailSettingsOut 200 ; configuration, adresse, domaines et quotas lus. SMTP réel non exercé. |
| `list_opds_tokens` | `GET /api/v1/opds/tokens` | OK | Liste OpdsTokenOut 200, vide puis peuplée ; aucun secret dans cette réponse. |
| `update_profile` | `PATCH /api/v1/users/me` | OK | kindle_email/default_format optionnels, clear_kindle_email envoie null ; PATCH 200 et restauration vérifiée. F05 concerne le null brut interdit en pratique sur default_format, non envoyé par cet outil. |
| `get_device` | `GET /api/v1/devices/{device_id}` | OK | UUID fourni ; 200 et rendu conforme à la promesse (nom/marque/modèle/tier/cloud/id). Adresse et preset présents dans API mais non affichés. |
| `add_device` | `POST /api/v1/devices` | OK | brand requis, name/model/email_address/conversion_profile optionnels : noms et types alignés ; création 201. Aucun delivery_tier envoyé. |
| `update_device` | `PATCH /api/v1/devices/{device_id}` | DÉFAUT | Champs de PATCH correctement nommés mais None toujours omis ; impossible de réinitialiser conversion_profile : refus local contre PATCH null 200, F02. |
| `remove_device` | `GET /api/v1/devices/{device_id}`<br>`DELETE /api/v1/devices/{device_id}` | OK | GET préalable 200, confirm=False sans suppression, DELETE 204 ; liseuse disparue à la relecture. |
| `link_device_cloud` | `GET /api/v1/devices/{device_id}/link` | DÉFAUT | provider requis bien envoyé, locale optionnel non exposé (fr par défaut). Dropbox et Drive répondent 503 sans URL : F08 ; OAuth complet non testé. |
| `set_source_enabled` | `PATCH /api/v1/sources/{source_id}` | OK | enabled:bool requis fourni ; PATCH false puis true : 200, état initial restauré. |
| `list_deliveries` | `GET /api/v1/deliveries` | OK | GET sans paramètre conforme ; limit est un découpage MCP, pas un paramètre API. Liste vide réelle 200 ; rendu de jobs couverts seulement par tests locaux. |
| `plan_delivery` | `GET /api/v1/books/{item_id}`<br>`GET /api/v1/users/me`<br>`GET /api/v1/devices`<br>`GET /api/v1/devices/{device_id}/methods`<br>`GET /api/v1/devices/{device_id}` | DÉFAUT | Lectures livre/profil/devices/methods : 200 ; format mobi annoncé pour Kindle alors que résolveur cœur produit epub : F03. |
| `diagnose` | `GET /api/v1/users/me`<br>`GET /api/v1/mail/settings`<br>`GET /api/v1/devices`<br>`GET /api/v1/deliveries`<br>`GET /api/v1/devices/{device_id}/methods` | OK | Agrégation de quatre lectures + méthodes : 200, diagnostic réel sans livraison. Branche historique en échec couverte seulement par tests. |
| `deliver_to_kindle` | `GET /api/v1/users/me`<br>`GET /api/v1/devices/{device_id}/methods`<br>`GET /api/v1/books/{item_id}`<br>`POST /api/v1/deliveries`<br>`PATCH /api/v1/users/me`<br>`GET /api/v1/devices/{device_id}`<br>`GET /api/v1/devices` | DÉFAUT | Corps de livraison conforme ; aperçu mobi erroné F03 et GET livre 404 ignoré F04. kindle_email modifie le profil même confirm=False, comportement annoncé dans docstring ; envoi non testé. |
| `search_library_items` | `GET /api/v1/books` | OK | query traduit en q, page/limit envoyés ; 200, filtre insensible à la casse vérifié sur Audit Titre. Réponse paginée correctement exploitée. |
| `update_library_item` | `PATCH /api/v1/books/{item_id}` | DÉFAUT | Les huit champs de PATCH existent ; effacement page_count=None refusé localement, mais null API accepté (200), F02. |
| `delete_library_item` | `GET /api/v1/books/{item_id}`<br>`DELETE /api/v1/books/{item_id}` | OK | GET préalable, garde-fou et DELETE alignés ; prévisualisation sans mutation, suppressions 204 et total final nul. |
| `list_library_item_deliveries` | `GET /api/v1/books/{item_id}/deliveries` | OK | item_id fourni ; liste DeliveryOut réelle 200 vide. Rendu de liste peuplée couvert par tests, pas en production. |
| `download_library_item` | `POST /api/v1/books/{item_id}/download-link` | OK | POST format optionnel JSON conforme (alternative query non nécessaire) : 200 ; URL produite téléchargée avec 200, fichier EPUB de 1213 octets. TTL configurable, défaut 900 s. |
| `create_gateway` | `POST /api/v1/gateways` | OK | name optionnel envoyé ; 201, gateway_id et deux secrets réellement utilisables pour pair/poll. Durées de configuration non affichées. |
| `recreate_gateway` | `POST /api/v1/gateways/{gateway_id}/recreate` | OK | Aucun corps requis ; 200 si pending/révoquée, ancien token ensuite refusé 400. Sur paired : 409 intentionnel, révoquer avant (précondition peu visible dans aide MCP). |
| `revoke_gateway` | `GET /api/v1/gateways`<br>`POST /api/v1/gateways/revoke` | OK | gateway_id UUID dans corps requis ; POST 200 puis ancienne clé refusée 401. confirm protège la mutation. |
| `delete_gateway` | `GET /api/v1/gateways`<br>`DELETE /api/v1/gateways/{gateway_id}` | OK | gateway_id dans chemin, DELETE 204 ; liste finale vide. Pas de corps attendu. |
| `list_gateway_jobs` | `GET /api/v1/gateways/{gateway_id}/jobs` | OK | gateway_id + limit envoyés ; 200, payload statut correctement rendu. Maximum API 100, non borné localement (422 au-delà attendu). |
| `create_opds_token` | `POST /api/v1/opds/tokens` | OK | label optionnel, 201 ; id/token/url/created_at conformes, catalogue réellement accessible avec ce token. |
| `revoke_opds_token` | `GET /api/v1/opds/tokens`<br>`POST /api/v1/opds/tokens/revoke` | OK | token_id UUID requis fourni ; 200 puis catalogue 404 et liste active vide. Garde-fou confirm présent. |

### Options et réponses : contrôle transversal

- Les champs requis déclarés sont fournis sur tous les appels MCP typés. `POST /books` fait exception au contrôle automatique : pas de requestBody OpenAPI. `source` et `result_id` sont indispensables au code pour la branche connecteur ; `result` est facultatif techniquement mais nécessaire à la fidélité des métadonnées. Il ne faut pas le présenter comme un champ formellement requis par le schéma.
- Options non exposées : `locale` du lien cloud (retour français par défaut), valeurs null de certains PATCH (F02). `q` est exposé par search_library_items plutôt que list_library ; la variante query de download-link a son équivalent JSON. `limit` des livraisons est local car l’API n’en accepte pas. Les maxima API 200 livres et 100 jobs restent validés par le cœur.
- Aucun nom de clé de réponse effectivement utilisé n’a été trouvé absent du modèle correspondant. Les replis `id`/`gateway_id` et `job_id`/`id` sont défensifs ; la production renvoie gateway_id et job_id. L’union livre 201 / job 202 est correctement distinguée par add_to_library. Le défaut F01 porte sur les données envoyées, pas sur la lecture de cette union.
- Les valeurs optionnelles métier absentes de l’affichage MCP ne sont pas toutes des défauts : détails bibliographiques, état du preset, limites temporelles gateway, auteur d’une livraison. Leur utilité et les appelants non MCP sont examinés ci-dessous.

## 3. Les 55 opérations du cœur

Les codes sont réellement observés sur le domaine de production, sauf mention explicite « interne ». Un code 404 sur une ressource fictive ne compte pas comme succès du parcours positif. « Web » ci-dessous désigne un appelant trouvé dans le code, pas une session de navigateur testée.

| Méthode | Chemin | Verdict | HTTP observé et preuve | Appelant identifié |
|---|---|---|---|---|
| GET | `/api/v1/books` | OK | 200 ; vide, peuplé, pagination limit=1 et q=« audit titre » effectifs. | MCP + web |
| POST | `/api/v1/books` | DÉFAUT | 201 import, 202 gateway ; métadonnées perdues F01, [] donne 500 F06, contrat incomplet F07. | MCP + web |
| POST | `/api/v1/books/search` | OK | 200 ; Gutenberg, Standard Ebooks et résultat gateway simulé réellement retournés. | MCP + web |
| POST | `/api/v1/books/upload` | OK | 201 ; EPUB minimal importé puis lu et téléchargé. | Web + agent watcher |
| DELETE | `/api/v1/books/{item_id}` | OK | 204 ; tous les livres temporaires supprimés, liste finale vide. | MCP + web |
| GET | `/api/v1/books/{item_id}` | OK | 200 sur livres du test ; 404 UUID nul (aperçu Kindle). | MCP |
| PATCH | `/api/v1/books/{item_id}` | DÉFAUT | 200 métadonnées et page_count:null ; title:null produit 500, F05. | MCP + web |
| GET | `/api/v1/books/{item_id}/deliveries` | OK | 200 liste vide pour un vrai livre ; aucun historique positif créé. | MCP + web |
| POST | `/api/v1/books/{item_id}/download-link` | OK | 200, URL signée puis téléchargement 200 ; format original EPUB. | MCP |
| GET | `/api/v1/covers/{item_id}` | OK | 200 image sur livre avec couverture ; 404 sans couverture. | Web (proxy image) |
| GET | `/api/v1/deliveries` | OK | 200 liste vide initiale/finale ; pas de livraison réelle. | MCP + web |
| POST | `/api/v1/deliveries` | NON VÉRIFIABLE | 400 pour dropbox sur Kindle ; rejet cohérent. Aucun envoi SMTP/cloud/code court créé. | MCP + web |
| GET | `/api/v1/deliveries/{job_id}` | NON VÉRIFIABLE | 404 sur UUID nul ; aucun job du compte à lire positivement. | MCP + web |
| GET | `/api/v1/devices` | OK | 200 vide puis deux créations successives visibles. | MCP + web |
| POST | `/api/v1/devices` | OK | 201 ; Kindle avec adresse autorisée, tier A calculé. | MCP + web |
| DELETE | `/api/v1/devices/{device_id}` | OK | 204 puis liste vide. | MCP + web |
| GET | `/api/v1/devices/{device_id}` | OK | 200 ; identité, adresse, tier et preset relus. | MCP + web |
| PATCH | `/api/v1/devices/{device_id}` | DÉFAUT | 200 nom/preset/null du preset ; brand:null produit 500, F05. | MCP + web |
| GET | `/api/v1/devices/{device_id}/link` | DÉFAUT | 503 Dropbox et Drive : identifiants client absents, F08. | MCP + web |
| GET | `/api/v1/devices/{device_id}/link/callback` | NON VÉRIFIABLE | 302 sans code/state, comportement de refus attendu ; pas de consentement fournisseur. | Navigateur retour OAuth |
| POST | `/api/v1/devices/{device_id}/link/callback` | NON VÉRIFIABLE | 400 provider=invalid ; échange valide impossible sans OAuth. | Aucun appelant produit trouvé ; compatibilité API explicite |
| GET | `/api/v1/devices/{device_id}/methods` | OK | 200 ; email disponible avec adresse Kindle connue. | MCP + web |
| GET | `/api/v1/downloads/{token}` | OK | 200, 1213 octets EPUB pour le jeton signé créé ; aucun Bearer nécessaire. | Lien rendu par MCP, ouvert par utilisateur |
| GET | `/api/v1/gateways` | OK | 200 ; pending/paired visibles, vide après nettoyage. | MCP + web |
| POST | `/api/v1/gateways` | OK | 201 ; secrets réellement utilisés pour appairer. | MCP + web |
| GET | `/api/v1/gateways/jobs/{job_id}` | OK | 200 ; pending puis done avec library_item_id ; search done aussi lu. | MCP + web |
| POST | `/api/v1/gateways/jobs/{job_id}/fetch-result` | OK | 200 ; imports EPUB réels, dont deux successifs sur même gateway. Ancien défaut absent. | Gateway worker |
| POST | `/api/v1/gateways/jobs/{job_id}/search-results` | OK | 200 sur job search ; résultat ressort dans books/search. 409 si mauvais type fetch. | Gateway worker |
| POST | `/api/v1/gateways/pair` | OK | 200 avec secret courant ; 400 avec ancien secret après rotation. | Gateway worker |
| POST | `/api/v1/gateways/poll` | DÉFAUT | 204 sans job, 200 avec job, 401 clé révoquée : fonctionnement OK, 204 absent du contrat F07. | Gateway worker |
| POST | `/api/v1/gateways/revoke` | OK | 200 ; ancienne clé refusée 401 ensuite. | MCP + web |
| DELETE | `/api/v1/gateways/{gateway_id}` | OK | 204 ; gateways et jobs liés nettoyés. | MCP + web |
| GET | `/api/v1/gateways/{gateway_id}/jobs` | OK | 200, listes vide puis fetch avec statut et tentatives. | MCP + web |
| POST | `/api/v1/gateways/{gateway_id}/recreate` | OK | 200 pending/révoquée ; 409 paired est une protection intentionnelle. | MCP + web |
| GET | `/api/v1/mail/settings` | OK | 200 ; configured=true, adresse expéditeur, domaines, quotas 30/h et 80/j. | MCP + web |
| GET | `/api/v1/opds/tokens` | OK | 200 ; liste sans secret, vide après révocation. | MCP + web |
| POST | `/api/v1/opds/tokens` | OK | 201 ; jeton créé ouvre un catalogue 200. | MCP + web |
| POST | `/api/v1/opds/tokens/revoke` | OK | 200 ; catalogue révoqué 404, aucun jeton actif restant. | MCP + web |
| GET | `/api/v1/sources` | OK | 200 ; sources initiales identiques après nettoyage complet. | MCP + web |
| PATCH | `/api/v1/sources/{source_id}` | OK | 200 ; false puis true, restauration contrôlée. | MCP + web |
| GET | `/api/v1/users/me` | OK | 200 ; bon compte et profil final identique à initial. | MCP + web |
| PATCH | `/api/v1/users/me` | DÉFAUT | 200 changement/effacement/restauration ; default_format:null produit 500, F05 ; corps générique F07. | MCP + web |
| GET | `/c/{code}` | NON VÉRIFIABLE | Non appelé : aucun code de livraison tier C existant ; aucun code inventé. | Navigateur liseuse via lien de livraison |
| GET | `/c/{code}/download` | NON VÉRIFIABLE | Non appelé : aucun code de livraison tier C existant ; aucun code inventé. | Navigateur liseuse via lien de livraison |
| GET | `/health` | NON VÉRIFIABLE | Public : 307 vers /fr/health puis 404. Interne conteneur : 200 ; état ok, Calibre disponible pour healthz. | Healthcheck Docker / exploitation |
| GET | `/healthz` | NON VÉRIFIABLE | Public : 307 vers /fr/healthz puis 404. Interne conteneur : 200 ; état ok, Calibre disponible pour healthz. | Healthcheck Docker / exploitation |
| GET | `/opds/{token}` | DÉFAUT | 200 XML servi, mais OpenAPI annonce application/json : F07. Catalogue/filtres testés avec jeton actif. | Client OPDS via liens du catalogue |
| GET | `/opds/{token}/all` | DÉFAUT | 200 XML servi, mais OpenAPI annonce application/json : F07. Catalogue/filtres testés avec jeton actif. | Client OPDS via liens du catalogue |
| GET | `/opds/{token}/author` | DÉFAUT | 200 XML servi, mais OpenAPI annonce application/json : F07. Catalogue/filtres testés avec jeton actif. | Client OPDS via liens du catalogue |
| GET | `/opds/{token}/authors` | DÉFAUT | 200 XML servi, mais OpenAPI annonce application/json : F07. Catalogue/filtres testés avec jeton actif. | Client OPDS via liens du catalogue |
| GET | `/opds/{token}/cover/{item_id}` | OK | 200 image réelle ; 404 sans couverture. Métadonnées de réponse OpenAPI trop génériques (voir F07). | Client OPDS |
| GET | `/opds/{token}/download/{item_id}` | OK | 200 fichier EPUB ; format original. Contrat de réponse non typé (voir F07). | Client OPDS |
| GET | `/opds/{token}/opensearch.xml` | DÉFAUT | 200 XML servi, mais OpenAPI annonce application/json : F07. Catalogue/filtres testés avec jeton actif. | Client OPDS via liens du catalogue |
| GET | `/opds/{token}/recent` | DÉFAUT | 200 XML servi, mais OpenAPI annonce application/json : F07. Catalogue/filtres testés avec jeton actif. | Client OPDS via liens du catalogue |
| GET | `/opds/{token}/search` | DÉFAUT | 200 XML servi, mais OpenAPI annonce application/json : F07. Catalogue/filtres testés avec jeton actif. | Client OPDS via liens du catalogue |

### Appelants inverses et champs de réponse non exploités

Les références concrètes sont conservées dans [callers-web.txt](callers-web.txt) et [callers.txt](callers.txt). Les fichiers TypeScript générés ne constituent pas un appelant. L’agent gateway appelle pair/poll/search-results/fetch-result ; son watcher utilise upload. Les routes OPDS, téléchargement signé et tier C sont consommées par des liens, pas nécessairement par un fetch JavaScript.

| Famille de réponse | Champs peu ou pas exploités par le MCP | Autre utilisation / conclusion |
|---|---|---|
| ResultOut | magnet_url, guid, indexer_id, seeders, isbn, cover_url, language, description, page_count | Le web repasse le résultat complet à books ; le MCP ne le repasse pas : F01. seeders/indexer_id sont présents mais aucune lecture explicite utile par le MCP ; le worker utilise la référence de téléchargement. |
| LibraryItemOut | cover_url, source_id, added_at, description, language, page_count, size_bytes, isbn, publisher, published_year, source_ref selon outil | Le web affiche détails/couverture/taille/date ; source_ref sert aux filtres de bibliothèque. Les mises à jour MCP rendent language/isbn mais pas toutes les valeurs modifiées. Aucun livre invisible à cause d’une clé mal nommée trouvé. |
| DeviceOut | email_address, conversion_profile, last_synced_at dans list/get | email_address est lu par plan_delivery/deliver_to_kindle ; le web lit last_synced_at et le preset. Affichage MCP volontairement résumé, réinitialisation du preset limitée par F02. |
| DeliveryOut | item_author, library_item_id, device_id selon outil | item_author est affiché par le web ; identifiants utilisés pour relations. download_url est optionnel, principalement renvoyé à la création tier C ; sa persistance en lecture n’est pas garantie par le code et reste non testée. |
| GatewayCredentials / GatewayOut | pairing_token_ttl_minutes, gateway_online_seconds | Le web utilise ces valeurs pour échéance et état en ligne ; le MCP n’affiche que pairing_expires_at et last_seen_at. Pas de perte de secret ni de confusion id observée. |
| GatewayJobStatusOut | payload | Le web lit payload pour son sous-titre ; le worker l’utilise pour exécuter le job. get_gateway_job se limite au suivi, conformément à sa promesse. |
| SourceOut | created_at | Aucune lecture explicite trouvée dans les outils MCP ni la vue des sources web ; champ d’information inutilisé, pas une panne. |
| UserOut / MailSettingsOut / OpdsToken* / DownloadLinkOut | Aucun champ nécessaire oublié | Valeurs nécessaires lues, secret OPDS uniquement à la création ; pagination repose sur items,total,page, limit restant connu du demandeur. |

Le **POST callback cloud** n’a pas d’appelant produit trouvé : le web passe par le GET callback, le code annonce explicitement conserver le POST pour les clients API. Ce n’est pas un endpoint cassé par son absence d’appelant interne. La branche multipart historique de POST /books n’est plus l’upload du web ; la route dédiée /upload est utilisée. Aucune suppression de ces compatibilités n’est proposée sans décision opérateur.

## 4. Défauts reproduits

### F01 — Métadonnées perdues entre recherche MCP et ajout — **majeur**

**Symptôme observé.** Le résultat Gutenberg `1342`, « Pride and Prejudice », auteur « Jane Austen », est importé avec le corps exact du MCP `{"source":"gutenberg","result_id":"1342"}` : **201**, titre `tmpmb414kk2`, auteur vide, aucune métadonnée bibliographique. Après suppression, le même import avec `result` donne **201**, titre et auteur corrects. Côté gateway, un ajout minimal reçoit **202** puis le job transmet `title: audit-reference` et `author: ""` ; le payload d’import conserve ce titre. Ce n’est pas une erreur seulement cosmétique dans le message MCP : la donnée stockée est incorrecte.

**Preuve.** [http.jsonl](http.jsonl), entrées 31, 65–70 et 91 ; [lifecycle.py](lifecycle.py), [followup.py](followup.py). Livres `4fc9b701-a280-4b95-9d77-2d0d58ebeba8` et `f7746c9c-869a-416f-a72e-d4d2b47b8910` pour la comparaison sans/avec résultat.

**Cause racine.** `mcp-server/ferry_mcp/server.py:424` n’expose que source/result_id et `:437` construit ce corps minimal. `src/ferry_agent/services/library.py:125` utilise les métadonnées reçues ou, à défaut, `fetched.stem` (`:128`). La branche gateway remplace le titre absent par result_id (`src/ferry_agent/api/books.py:359`). Le web transmet bien `result` (`web/components/app/library/library-view.tsx:367`). `search_library` réduit également la réponse à du texte sans préserver le résultat complet pour l’étape suivante.

**Correctif proposé.** Préserver le résultat structuré de recherche et le transmettre à l’ajout, ou faire résoudre de manière fiable les métadonnées par le cœur à partir d’un identifiant de résultat. Inclure titre/auteur et les métadonnées effectivement disponibles. Ne pas fabriquer des champs absents de la source.

**Vérification après correction.** Recherche puis ajout par l’outil MCP, sans intervention web : titre et auteur identiques au résultat pour Gutenberg et une gateway ; couverture/langue/ISBN conservés lorsqu’ils existent. Test de régression sur le livre réellement persisté, pas seulement sur l’appel HTTP. Intégration Postgres pour la persistance et deux imports gateway successifs.

### F02 — Effacements impossibles dans deux outils MCP — **mineur**

**Symptôme observé.** Après `page_count=12`, `update_library_item(page_count=None)` retourne « fournir au moins un champ » et laisse 12 ; le PATCH REST `{"page_count":null}` répond **200** et efface la valeur. Même résultat pour `update_device(conversion_profile=None)` : refus local, alors que le PATCH REST avec null répond **200** et efface le preset (`conversion_profile: null` dans la réponse). Il s’agit de champs où null est réellement utile et accepté, contrairement à F05.

**Preuve.** [wrapper-results.jsonl](wrapper-results.jsonl), appels update_device/update_library_item ; [http.jsonl](http.jsonl), entrées 112–118 ; [wrapper-http.jsonl](wrapper-http.jsonl). Le même filtrage touche description, language, publisher, published_year, isbn et les champs nullable de liseuse. L’adresse email possède une échappatoire `""` reconnue par le cœur ; les nombres et presets n’en ont pas.

**Cause racine.** `mcp-server/ferry_mcp/server.py:1049` et `:1773` construisent le PATCH avec des tests `is not None` (`:1059`, `:1782`). Omission et null explicite deviennent indiscernables. Les schémas et handlers du cœur utilisent au contraire `exclude_unset=True`.

**Correctif proposé.** Distinguer champ absent et effacement explicite, par exemple avec une liste de champs à effacer, ou des paramètres clear dédiés comme pour kindle_email. Ne pas autoriser l’effacement des champs obligatoires en base.

**Vérification après correction.** Régler puis effacer un compteur de pages et un preset par le MCP ; relire le cœur et vérifier la valeur finale. Vérifier aussi qu’un champ omis reste inchangé.

### F03 — Format annoncé par l’aperçu Kindle différent du cœur — **mineur**

**Symptôme observé.** Sur un livre EPUB et une Kindle réelle du compte test, `plan_delivery(format="mobi")` affiche « Format cible résolu: mobi » et `deliver_to_kindle(confirm=False, format="mobi")` affiche « format cible: mobi ». L’exécution locale du résolveur réellement utilisé par le cœur retourne **epub** pour mobi et azw3. Aucun e-mail n’a été envoyé pour cette vérification.

**Preuve.** [wrapper-results.jsonl](wrapper-results.jsonl), lectures de production **200** dans [wrapper-http.jsonl](wrapper-http.jsonl), et [format-proof.txt](format-proof.txt) pour l’exécution de la fonction cœur. C’est une divergence exécutée entre deux fonctions, pas une observation de remise sur liseuse.

**Cause racine.** Le helper générique MCP `mcp-server/ferry_mcp/server.py:315` choisit demandé > défaut > original sans tenir compte de la marque. `src/ferry_agent/services/kindle_formats.py:33` applique le repli Kindle, appelé dans `src/ferry_agent/services/delivery.py:130`.

**Correctif proposé.** Utiliser la même résolution par cible dans les aperçus et la livraison ; distinguer format demandé et format effectivement produit. Une prévisualisation fournie par le cœur éviterait deux règles divergentes.

**Vérification après correction.** Pour Kindle, mobi et azw3 doivent annoncer epub dans les deux aperçus ; epub et pdf doivent rester inchangés. Ces assertions sont possibles sans envoi réel.

### F04 — L’aperçu Kindle ignore un livre introuvable — **mineur**

**Symptôme observé.** `deliver_to_kindle(item_id="00000000-0000-0000-0000-000000000000", device_id=<Kindle test>, confirm=False)` reçoit **404** du cœur mais rend une prévisualisation normale et la commande confirm=True « pour envoyer ». Il ne signale pas que le livre est absent. Cela ne prouve pas qu’un envoi ultérieur réussirait : le défaut est l’aperçu trompeur.

**Preuve.** [wrapper-results.jsonl](wrapper-results.jsonl), appel avec UUID nul, et [wrapper-http.jsonl](wrapper-http.jsonl), GET correspondant 404.

**Cause racine.** `mcp-server/ferry_mcp/server.py:1634` lit le livre puis `:1637` ne traite que le cas non erroné ; aucune `_raise_for` sur cette réponse. Le flux continue avec original_format=None et un titre inconnu.

**Correctif proposé.** Traiter les erreurs de lecture du livre avant toute prévisualisation ou commande d’envoi, comme plan_delivery le fait déjà.

**Vérification après correction.** Un vrai 404 doit produire « ressource introuvable », aucun aperçu de succès et aucun POST de livraison. Vérifier aussi 401/403 et 500 sans les masquer.

### F05 — Schémas nullable incompatibles avec les données obligatoires — **majeur**

**Symptôme observé.** Trois PATCH sur le seul compte test donnent **500 Internal Server Error** : livre `{"title":null}`, liseuse `{"brand":null}`, profil `{"default_format":null}`. Les lectures suivantes sont **200** et confirment que les valeurs précédentes sont préservées : pas de corruption persistante constatée. L’API accepte trop loin des entrées qu’elle devrait refuser proprement.

**Preuve.** [http.jsonl](http.jsonl), entrées 39, 58 et 119 ; requêtes dans [lifecycle.py](lifecycle.py) et [wrappers.py](wrappers.py). Les erreurs ne dépendent pas d’un mauvais jeton : les requêtes adjacentes répondent 200.

**Cause racine.** `src/ferry_agent/schemas.py:144` (title/author), `:210` (brand) et `:237` (default_format) acceptent None. Les handlers les appliquent tels quels : `api/books.py:435`, `api/devices.py:169`, `api/users.py:72`. Les colonnes correspondantes sont non nullables (`models.py:143`, `:111`, `:100`). Pour le profil, l’OpenAPI générique masque en outre ces règles (F07). L’incompatibilité code/contrainte explique les 500 ; aucune lecture de journaux d’autres utilisateurs n’a été nécessaire.

**Correctif proposé.** Autoriser l’omission, refuser null avec une réponse de validation pour les champs obligatoires ; conserver null pour les vrais effacements, dont kindle_email et métadonnées facultatives. Documenter cette distinction dans le contrat.

**Vérification après correction.** Tests HTTP avec Postgres réel : les trois null donnent 422 ou un refus métier documenté, valeurs inchangées ; null sur page_count et kindle_email fonctionne toujours. Ajouter author:null au test de contrainte, son échec est attendu du code mais n’a pas été tenté ici.

### F06 — POST /books plante sur un JSON de mauvais type — **majeur**

**Symptôme observé.** `POST /api/v1/books`, Content-Type application/json, corps `[]` : **500**. Le corps `{}` donne au contraire **400** avec « fournir soit file, soit source + result_id ». Aucun livre n’est créé par ces deux essais.

**Preuve.** [http.jsonl](http.jsonl), entrées 56–57 ; [lifecycle.py](lifecycle.py), requêtes JSON exactes.

**Cause racine.** `src/ferry_agent/api/books.py:312` affecte sans validation `request.json()` à data ; `:328` appelle ensuite data.get. Une liste JSON n’a pas cette méthode. Le corps n’est pas un modèle Pydantic.

**Correctif proposé.** Valider le type et la structure avant de traiter les branches ; un modèle explicite doit également alimenter OpenAPI. Traiter le JSON syntaxiquement invalide avec un 4xx documenté.

**Vérification après correction.** Tableau, null, scalaire et JSON tronqué : 400/422, pas 500 et aucune mutation. Conserver les imports JSON et multipart valides. Seul le tableau a été reproduit ici ; les autres entrées sont des cas à ajouter à la régression.

### F07 — Contrat publié incomplet ou erroné — **mineur**

**Symptôme observé.** Le contrat identique dans le dépôt et en production :

- ne déclare aucun corps pour POST /books, alors que `{}` est refusé **400** et source/result_id donne **201** ou **202** ;
- décrit PATCH /users/me comme un objet quelconque, sans kindle_email/default_format ni leurs règles ;
- n’annonce pas le **202** réellement renvoyé pour un fetch gateway, ni le **204** réellement renvoyé par poll sans job ;
- annonce `application/json` pour les catalogues OPDS qui répondent **200** avec `application/atom+xml;profile=opds-catalog;kind=…` et pour opensearch.xml qui répond avec `application/opensearchdescription+xml`. Les routes binaires présentent également un schéma de succès vide plutôt qu’un contrat exploitable de fichier.

**Preuve.** [openapi-deployed.json](openapi-deployed.json), [http.jsonl](http.jsonl) (content_type explicite dans la dernière série OPDS), [opds_mime.py](opds_mime.py). Le test des bibliothèques API générées n’a pas été effectué ; le défaut observé est le contrat lui-même, pas un crash supposé de client.

**Cause racine.** Handler Request manuel (`api/books.py:295`), Body dict (`api/users.py:45`), statuts dynamiques sans déclaration responses (`api/books.py:385`, `api/gateways.py:150`), décorateurs OPDS sans response_class/media_type explicites (`api/opds.py:116` et suivants). Les types TypeScript générés héritent donc de ces lacunes.

**Correctif proposé.** Déclarer les modèles d’entrée, chaque réponse nominale réellement possible, et les types de contenu XML/fichier/redirection ; régénérer OpenAPI et les clients/types associés. Ne pas réduire l’union fonctionnelle pour faire simplement passer un test de fraîcheur.

**Vérification après correction.** Comparer schéma publié et réponses HTTP enregistrées : corps source/result_id/result typé, profil détaillé, 202 et 204 présents, XML annoncé correctement. Un test de contrat doit échouer sur l’OpenAPI actuel puis passer sur le contrat corrigé.

### F08 — Liaison Dropbox et Drive indisponible en production — **majeur**

**Symptôme observé.** Sur une liseuse appartenant au compte de test, `GET /api/v1/devices/{id}/link?provider=dropbox` répond **503**, détail « Dropbox non configure (DROPBOX_CLIENT_ID manquant) ». Avec drive : **503**, détail « Google Drive non configure (GOOGLE_CLIENT_ID manquant) ». Aucun lien d’autorisation n’est obtenu : le blocage précède le consentement utilisateur.

**Preuve.** [http.jsonl](http.jsonl), entrées 21–22 et [lifecycle.py](lifecycle.py). Il s’agit d’une indisponibilité de configuration déployée, pas d’un nom de paramètre MCP incorrect.

**Cause racine.** `src/ferry_agent/api/devices.py:250` et `:258` refusent la génération de lien lorsque l’identifiant client fournisseur est absent. Le 503 identifie précisément ces variables ; leur absence est inférée de ce chemin de code et du message, sans publier de configuration secrète.

**Correctif proposé.** Configurer les applications OAuth et leurs URL de retour valides dans le déploiement ; si la fonctionnalité n’est pas proposée dans cet environnement, l’indiquer avant de demander la liaison. Aucun réglage de production n’a été modifié par cet audit.

**Vérification après correction.** Les deux GET doivent répondre 200 avec URL d’autorisation cohérente ; effectuer ensuite avec l’opérateur le consentement, le callback, puis vérifier cloud_linked. Cette seconde étape restera nécessaire : un 200 de génération d’URL ne prouve pas une liaison complète.

## 5. Ce qui n’a pas pu être vérifié et comportements à ne pas confondre avec un défaut

- **Client MCP + Clerk** : pas de connexion Claude/ChatGPT ; découverte et transport authentifiés non exercés. La lecture croisée et les appels directs des fonctions ne remplacent pas cette connexion. La suite MCP locale utilise notamment un client en mémoire, sans connexion réelle au compte Clerk.
- **Envoi d’e-mail** : aucun POST email, aucun SMTP et aucun quota consommé. La disponibilité affichée du mode email est vérifiée ; ni acceptation par le relais ni remise Amazon ne sont prouvées.
- **Livraisons** : aucune livraison existante sur le compte ; liste et historique d’un livre sont testés vides, détail sur UUID nul retourne 404. Aucun succès réel de POST /deliveries dans cette passe.
- **Tier C `/c/{code}` et `/c/{code}/download`** : aucune livraison de ce type n’existe, aucun code n’a été inventé ou emprunté. Ces deux routes sont l’exception explicite à l’exercice empirique des GET ; leur code/contrat a été relu mais leur comportement positif n’est pas validé.
- **Cloud** : génération d’URL réellement testée (F08), mais aucun consentement Dropbox/Drive, ni callback positif, ni transfert de livre cloud. Le POST callback n’a été exercé que sur provider invalide pour éviter un échange externe.
- **Gateway physique** : pair/poll/jobs/résultats ont été exercés sur une gateway de test simulée avec sa propre clé ; aucun torrent, Transmission, Prowlarr ou équipement chez un utilisateur n’a été utilisé. L’import de fichiers et la recherche orchestrée par le cœur sont prouvés, pas le téléchargement externe de l’agent.
- **Sources légales** : recherche légale exécutée (11 résultats Gutenberg, 1 Standard Ebooks) ; imports avec métadonnées positifs pour les deux sources, chacun avec 201 puis lecture 200 et suppression 204. Pas de garantie sur toutes les recherches possibles ni sur la disponibilité future de ces sites.
- **Conversions** : téléchargement du format original prouvé ; la capacité Calibre est déclarée disponible par healthz interne. Aucun fichier réellement converti ni test de charge, de quota saturé, d’expiration après 15 minutes ou d’épuisement de code court.
- **Health public** : /health et /healthz sont exclus du routage core du domaine (`deploy/docker-compose.yml:123`) et passent au web (307 puis 404). Les routes répondent 200 dans le conteneur. À décider selon le besoin d’observabilité externe ; pas présenté comme une panne interne ni compté comme défaut bloquant.
- **confirm=False sur deliver_to_kindle** : la fourniture de kindle_email enregistre effectivement le profil, même en aperçu (PATCH 200 observé puis restauration). Le docstring le dit explicitement (`server.py:1515`, `:1542`) ; c’est un effet de bord à connaître, distinct d’un envoi de mail et non compté comme défaut caché.
- **Rotation gateway** : le 409 sur gateway déjà paired est intentionnel ; révocation puis régénération a réussi. Aucun faux défaut de rotation n’est déduit de ce 409.
- **Ancien défaut de Source gateway** : les deux fetch-result successifs de la dernière gateway répondent 200. Il n’est pas signalé à nouveau.
- **Isolation entre utilisateurs** : aucun accès à une ressource d’un autre utilisateur n’a été tenté. Le compte et les identifiants créés sont contrôlés ; cela ne constitue pas un audit de sécurité multi-utilisateur.

### Tests et règle de fin du dépôt

La commande demandée avec `mcp-server/.venv/bin/python` n’était pas possible : ce dépôt n’avait pas de `.venv`. Le premier essai avec l’environnement du dépôt voisin a donné 78 succès et 2 échecs liés à des versions incompatibles du SDK (`mcp` ancien, attribut challenge_scopes absent) : [mcp-tests.txt](mcp-tests.txt). Ces échecs ne sont pas comptés comme défauts du produit.

Un environnement isolé a ensuite été créé **dans audit/** avec les versions du workflow : `fastmcp==4.0.10`, `PyJWT[crypto]==2.13.0`, httpx, pydantic-settings, pytest et pytest-asyncio. Résultat : **80 passed in 3.59s**, [mcp-tests-pinned.txt](mcp-tests-pinned.txt). Commande exécutée depuis mcp-server :

```sh
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=. ../audit/venv/bin/python -m pytest tests -q -p no:cacheprovider
```

La CI distante complète n’a pas été lancée ni déclarée verte. Ce livrable est une revue sans correctif : aucun ticket de correction n’est déclaré terminé au sens AGENTS.md, aucun test « rouge avant / vert après correctif » ne peut être revendiqué. Les scénarios ci-dessus préparent ces régressions ; les correctifs SQL devront être validés avec Postgres réel. Aucun fichier de test du dépôt, migration, message utilisateur ou ADR n’a été modifié.

## 6. Créations et nettoyage en production

État initial vérifié : **0 livre, 0 liseuse, 0 gateway, 0 jeton OPDS actif, 0 livraison** ; profil kindle_email=null/default_format=epub ; trois sources activées (gutenberg, standard_ebooks, upload). Les identifiants exacts ci-dessous figurent aussi dans [created.json](created.json).

| Type | Identifiant | Nettoyage observé |
|---|---|---|
| Livre | `4fc9b701-a280-4b95-9d77-2d0d58ebeba8` | DELETE 204. |
| Livre | `153b921e-f4f7-4637-b33a-0d0bbd348875` | DELETE 204. |
| Livre | `1f88ef73-7e8c-465a-9731-ab249f752ab4` | DELETE 204. |
| Livre | `f7746c9c-869a-416f-a72e-d4d2b47b8910` | DELETE 204. |
| Livre | `6bbf9ea8-14da-41ef-9e3a-235cd3924bac` | DELETE 204. |
| Livre | `2edbdd1f-3637-4983-92d7-e8c8faca0d32` | DELETE 204. |
| Livre | `3629c5a5-5044-40c7-93f4-07a3cb2277b9` | DELETE 204. |
| Livre | `4f04d5c9-f9e7-451d-82ca-ea64ca65bdf0` | DELETE 204. |
| Liseuse | `d50eb7f8-7cc0-4fd5-9610-d7a3459554b6` | DELETE 204. |
| Liseuse | `96cdd9e1-a429-4bdb-a84b-18f67b48bca3` | DELETE 204. |
| Gateway | `ef224f1f-1cc5-41c3-8027-9f5e5c8f8c0f` | DELETE 204. |
| Gateway | `76703061-26c5-4961-90eb-605a51e1e274` | DELETE 204. |
| Gateway | `03e6ffe5-3df3-4a7f-9086-ca7ccc8182a2` | DELETE 204. |
| Jeton OPDS | `2907d228-e88b-4a17-8c61-b54ae6e18b06` | Révoqué, POST 200 ; absent de la liste active. |
| Jeton OPDS | `d710b4d0-c5f3-432b-b378-6a294d477c80` | Révoqué, POST 200 ; absent de la liste active. |
| Jeton OPDS | `2d1e1551-5381-4fe9-888f-87facf1d921d` | Révoqué, POST 200 ; absent de la liste active. |
| Jeton OPDS | `7eb8b47c-d0b6-415e-9be5-182f76d16fe1` | Révoqué, POST 200 ; absent de la liste active. |

Jobs gateway créés : `adcc93d0-f26d-44ef-afa5-6b20ffce62fd` (fetch), `011499da-7d40-4bfc-b807-f0c4174f3263` (search), `7bf66b50-7240-4177-8f35-6ebc6a69a06e` et `ca497a7a-64e8-4fa0-be9d-13fae8c74f2a` (deux fetch). Ils sont supprimés avec leurs gateways. Aucun job de livraison créé.

L’import gateway a créé la Source `aeac9e9a-f285-4af8-a513-98fe49c2f8de`, que la suppression de gateway ne retire pas automatiquement. Comme aucune route ne supprime une Source, cette seule ligne a été retirée par une transaction ciblée dans le cœur, après vérification de l’UUID, de l’utilisateur test, de sa date de création et de l’absence de livre référent ou de gateway restante. Script et résultat : [cleanup_source.py](cleanup_source.py), [source-cleanup.txt](source-cleanup.txt). Aucune autre Source ni donnée d’un autre utilisateur n’a été touchée.

Le profil a été restauré à kindle_email=null/default_format=epub. La source Gutenberg `700f7897-4ff7-48de-b6d7-534b33cae121`, temporairement désactivée, est réactivée ; les trois sources initiales ont les mêmes identifiants, dates et états. Les jetons OPDS révoqués restent des lignes d’historique côté serveur, conformément à l’API ; **aucun jeton actif** ne subsiste. Les livres visés par les liens de téléchargement ont été supprimés ; le rejeu de ces liens après suppression n’a pas été testé.

Dernière vérification : GET books/devices/gateways/opds/tokens/sources/users/me/deliveries tous **200** ; **0 livre, 0 liseuse, 0 gateway, 0 jeton OPDS actif, 0 livraison**, profil et sources restaurés. Les réponses finales sont les sept dernières entrées de [http.jsonl](http.jsonl).

## Résumé (huit lignes)

36 outils MCP et 55 opérations HTTP sur 44 chemins passés en revue, sans modification du produit.  
Aucun appel MCP ne vise une méthode ou un chemin inexistant.  
8 défauts reproduits : **0 bloquant, 4 majeurs, 4 mineurs**.  
Priorité 1 — **F01** : l’import MCP perd les métadonnées et stocke un titre temporaire.  
Priorité 2 — **F05** : des null acceptés par les schémas déclenchent des 500 sur livres, liseuses et profil.  
Priorité 3 — **F08** : Dropbox et Drive sont inutilisables dès la génération du lien (503 de configuration).  
80 tests MCP réussis ; client Clerk, envoi réel, consentement cloud et codes courts restent non validés.  
Compte de test nettoyé et état initial restauré ; aucune correction appliquée.
