import json,pathlib,re,hashlib
R=pathlib.Path(__file__).resolve().parent;root=R.parent
ops=json.loads((root/'openapi.json').read_text())['paths'];tools=json.loads((R/'contract-inventory.json').read_text());logs=[json.loads(l) for l in (R/'http.jsonl').read_text().splitlines()]
# Carefully reviewed per-tool outcomes; HTTP proof is qualified separately from client OAuth.
info={
'search_library':('OK','query:str requis, scope:list[str] optionnel ; liste ResultOut correctement parcourue. Recherche légale et gateway : 200 ; titres et identifiants rendus. Métadonnées non affichées : F01 au prochain ajout.'),
'add_to_library':('DÉFAUT','source/result_id envoyés ; result impossible à fournir. 201 avec titre tmpmb414kk2 ; gateway 202 puis titre audit-reference : F01. Contrat du corps absent : F07.'),
'list_library':('OK','page/limit entiers envoyés ; items,total,page lus correctement (200, bibliothèque vide puis peuplée). q couvert par search_library_items ; limite API 200.'),
'list_devices':('OK','Aucun paramètre requis ; liste DeviceOut (200), noms, marques, tier et état cloud rendus.'),
'list_device_methods':('OK','UUID de chemin fourni ; liste method/available/reason_code conforme, email disponible observé (200).'),
'deliver':('NON VÉRIFIABLE','Corps library_item_id/device_id/method + format conforme ; confirm=False testé sans POST. POST méthode indisponible : 400. Aucune livraison réelle autorisée dans cette passe.'),
'get_delivery_status':('NON VÉRIFIABLE','job_id fourni, clés DeliveryOut correctes ; 404 observé sur UUID nul. Aucun job réel disponible ; le 404 ne valide pas la lecture positive.'),
'list_gateways':('OK','Liste GatewayOut 200 ; gateway_id/status/last_seen_at conformes. Paramètres de durée non affichés mais utilisés par le web.'),
'get_gateway_job':('OK','job_id fourni ; 200 sur fetch pending puis done avec library_item_id ; 200 sur search done. Clés conformes.'),
'list_sources':('OK','Liste SourceOut 200 ; type/enabled/id conformes, created_at volontairement non affiché.'),
'get_profile':('OK','UserOut 200 ; les quatre champs métier retournés correctement.'),
'get_mail_settings':('OK','MailSettingsOut 200 ; configuration, adresse, domaines et quotas lus. SMTP réel non exercé.'),
'list_opds_tokens':('OK','Liste OpdsTokenOut 200, vide puis peuplée ; aucun secret dans cette réponse.'),
'update_profile':('OK','kindle_email/default_format optionnels, clear_kindle_email envoie null ; PATCH 200 et restauration vérifiée. F05 concerne le null brut interdit en pratique sur default_format, non envoyé par cet outil.'),
'get_device':('OK','UUID fourni ; 200 et rendu conforme à la promesse (nom/marque/modèle/tier/cloud/id). Adresse et preset présents dans API mais non affichés.'),
'add_device':('OK','brand requis, name/model/email_address/conversion_profile optionnels : noms et types alignés ; création 201. Aucun delivery_tier envoyé.'),
'update_device':('DÉFAUT','Champs de PATCH correctement nommés mais None toujours omis ; impossible de réinitialiser conversion_profile : refus local contre PATCH null 200, F02.'),
'remove_device':('OK','GET préalable 200, confirm=False sans suppression, DELETE 204 ; liseuse disparue à la relecture.'),
'link_device_cloud':('DÉFAUT','provider requis bien envoyé, locale optionnel non exposé (fr par défaut). Dropbox et Drive répondent 503 sans URL : F08 ; OAuth complet non testé.'),
'set_source_enabled':('OK','enabled:bool requis fourni ; PATCH false puis true : 200, état initial restauré.'),
'list_deliveries':('OK','GET sans paramètre conforme ; limit est un découpage MCP, pas un paramètre API. Liste vide réelle 200 ; rendu de jobs couverts seulement par tests locaux.'),
'plan_delivery':('DÉFAUT','Lectures livre/profil/devices/methods : 200 ; format mobi annoncé pour Kindle alors que résolveur cœur produit epub : F03.'),
'diagnose':('OK','Agrégation de quatre lectures + méthodes : 200, diagnostic réel sans livraison. Branche historique en échec couverte seulement par tests.'),
'deliver_to_kindle':('DÉFAUT','Corps de livraison conforme ; aperçu mobi erroné F03 et GET livre 404 ignoré F04. kindle_email modifie le profil même confirm=False, comportement annoncé dans docstring ; envoi non testé.'),
'search_library_items':('OK','query traduit en q, page/limit envoyés ; 200, filtre insensible à la casse vérifié sur Audit Titre. Réponse paginée correctement exploitée.'),
'update_library_item':('DÉFAUT','Les huit champs de PATCH existent ; effacement page_count=None refusé localement, mais null API accepté (200), F02.'),
'delete_library_item':('OK','GET préalable, garde-fou et DELETE alignés ; prévisualisation sans mutation, suppressions 204 et total final nul.'),
'list_library_item_deliveries':('OK','item_id fourni ; liste DeliveryOut réelle 200 vide. Rendu de liste peuplée couvert par tests, pas en production.'),
'download_library_item':('OK','POST format optionnel JSON conforme (alternative query non nécessaire) : 200 ; URL produite téléchargée avec 200, fichier EPUB de 1213 octets. TTL configurable, défaut 900 s.'),
'create_gateway':('OK','name optionnel envoyé ; 201, gateway_id et deux secrets réellement utilisables pour pair/poll. Durées de configuration non affichées.'),
'recreate_gateway':('OK','Aucun corps requis ; 200 si pending/révoquée, ancien token ensuite refusé 400. Sur paired : 409 intentionnel, révoquer avant (précondition peu visible dans aide MCP).'),
'revoke_gateway':('OK','gateway_id UUID dans corps requis ; POST 200 puis ancienne clé refusée 401. confirm protège la mutation.'),
'delete_gateway':('OK','gateway_id dans chemin, DELETE 204 ; liste finale vide. Pas de corps attendu.'),
'list_gateway_jobs':('OK','gateway_id + limit envoyés ; 200, payload statut correctement rendu. Maximum API 100, non borné localement (422 au-delà attendu).'),
'create_opds_token':('OK','label optionnel, 201 ; id/token/url/created_at conformes, catalogue réellement accessible avec ce token.'),
'revoke_opds_token':('OK','token_id UUID requis fourni ; 200 puis catalogue 404 et liste active vide. Garde-fou confirm présent.'),
}
lines=['# Revue fonctionnelle Ferry Agent — FA-AUDIT-MCP-FULL-01','',
'Date : 3 octobre 2026. Dépôt audité : `/home/glados/projects/ferry-agent-gwfix` (chemin physique `/mnt/HC_Volume_106803131/projects/ferry-agent-gwfix`). Branche et base `7759bf69` : informations fournies par le commanditaire, non vérifiées par git. Aucune commande git, aucune correction du produit. Seul `audit/` a été écrit dans le dépôt.','',
'## 1. Périmètre et valeur des verdicts','',
'**36 outils MCP et 55 opérations HTTP, sur 44 chemins OpenAPI, ont été examinés.** Aucun appel MCP ne vise une méthode ou un chemin absent. Cela ne suffit pas à garantir le résultat métier : huit défauts sont détaillés plus bas.','',
'**OK** signifie que le contrat et le scénario précisé sont vérifiés, pas que tous les cas possibles sont couverts. **DÉFAUT** indique une anomalie reproduite, y compris du contrat publié ; le scénario nominal peut fonctionner. **NON VÉRIFIABLE** signifie que la preuve positive manque, même lorsqu’un rejet HTTP attendu a été obtenu. Les succès de formatage et de corps HTTP MCP ne valent pas validation OAuth depuis Claude/ChatGPT.','',
'Authentification : assertion Ed25519, iss=ferry-agent-mcp, aud=ferry-core, sub=audit, email du compte dédié, TTL 240 s et jti aléatoire. Premier `GET /api/v1/users/me` : **200**, utilisateur `48c90f27-b635-42b0-9b89-73b21d345088`, email exact vérifié. Aucun jeton signé ni clé privée n’est fourni dans ce rapport.','',
'Les trois contrats ont été comparés : `openapi.json`, OpenAPI généré par le code local, OpenAPI servi par le conteneur de production. **Ils sont identiques** (pas seulement leurs chemins). Le chemin public `/openapi.json` est routé vers le web (307 puis 404) ; le contrat déployé a donc été lu via HTTP sur `127.0.0.1:8000` à l’intérieur du conteneur, sans modification. Preuves : [openapi-code.json](openapi-code.json), [openapi-deployed.json](openapi-deployed.json), [openapi-diff.txt](openapi-diff.txt). `openapi-live.json` conserve la première réponse publique non JSON, pas un contrat exploitable.','',
'Les preuves HTTP horodatées sont dans [http.jsonl](http.jsonl), avec corps de réponse expurgés. Les premiers essais sont reconstituables exactement via [lifecycle.py](lifecycle.py) ; les suivants enregistrent aussi les corps JSON envoyés. Les fonctions MCP ont en outre été appelées directement en Python, en remplaçant seulement la résolution d’identité et le client HTTP pour utiliser cette assertion : [wrappers.py](wrappers.py), [wrapper-results.jsonl](wrapper-results.jsonl), [wrapper-http.jsonl](wrapper-http.jsonl). Ce n’est pas un client MCP authentifié. Un verrou dans ce banc interdit tout POST de livraison.','',
'## 2. Les 36 outils MCP','',
'Chaque ligne vérifie chemin/méthode, corps, paramètres requis et lecture de réponse. Tous utilisent `Authorization: Bearer <assertion>` et `User-Agent: ferry-agent-mcp` ; httpx ajoute `Content-Type: application/json` aux corps JSON. Aucun en-tête métier requis oublié sur les routes utilisateur. Les détails exhaustifs des signatures, appels, paramètres et schémas requis sont dans [CONTRATS.md](CONTRATS.md), générés par [contract_inventory.py](contract_inventory.py).','',
'| Outil | Endpoint(s) appelés, helpers inclus | Verdict | Preuve et couverture des paramètres |','|---|---|---|---|']
for t in tools:
 calls=list(dict.fromkeys(c['method']+' '+c['path'] for c in t['calls']))
 verdict,proof=info[t['name']]
 lines.append('| `'+t['name']+'` | '+'<br>'.join('`'+c+'`' for c in calls)+' | '+verdict+' | '+proof+' |')
lines += ['', '### Options et réponses : contrôle transversal','',
'- Les champs requis déclarés sont fournis sur tous les appels MCP typés. `POST /books` fait exception au contrôle automatique : pas de requestBody OpenAPI. `source` et `result_id` sont indispensables au code pour la branche connecteur ; `result` est facultatif techniquement mais nécessaire à la fidélité des métadonnées. Il ne faut pas le présenter comme un champ formellement requis par le schéma.','- Options non exposées : `locale` du lien cloud (retour français par défaut), valeurs null de certains PATCH (F02). `q` est exposé par search_library_items plutôt que list_library ; la variante query de download-link a son équivalent JSON. `limit` des livraisons est local car l’API n’en accepte pas. Les maxima API 200 livres et 100 jobs restent validés par le cœur.','- Aucun nom de clé de réponse effectivement utilisé n’a été trouvé absent du modèle correspondant. Les replis `id`/`gateway_id` et `job_id`/`id` sont défensifs ; la production renvoie gateway_id et job_id. L’union livre 201 / job 202 est correctement distinguée par add_to_library. Le défaut F01 porte sur les données envoyées, pas sur la lecture de cette union.','- Les valeurs optionnelles métier absentes de l’affichage MCP ne sont pas toutes des défauts : détails bibliographiques, état du preset, limites temporelles gateway, auteur d’une livraison. Leur utilité et les appelants non MCP sont examinés ci-dessous.','',
'## 3. Les 55 opérations du cœur','',
'Les codes sont réellement observés sur le domaine de production, sauf mention explicite « interne ». Un code 404 sur une ressource fictive ne compte pas comme succès du parcours positif. « Web » ci-dessous désigne un appelant trouvé dans le code, pas une session de navigateur testée.','',
'| Méthode | Chemin | Verdict | HTTP observé et preuve | Appelant identifié |','|---|---|---|---|---|']
# Explicit endpoint evaluation, all 55 entries checked against inventory.
E={}
def e(m,p,v,proof,caller='MCP + web'):E[(m,p)]=(v,proof,caller)
e('GET','/api/v1/books','OK','200 ; vide, peuplé, pagination limit=1 et q=« audit titre » effectifs.')
e('POST','/api/v1/books','DÉFAUT','201 import, 202 gateway ; métadonnées perdues F01, [] donne 500 F06, contrat incomplet F07.')
e('POST','/api/v1/books/search','OK','200 ; Gutenberg 1342 et résultat gateway simulé réellement retournés.')
e('POST','/api/v1/books/upload','OK','201 ; EPUB minimal importé puis lu et téléchargé.','Web + agent watcher')
e('DELETE','/api/v1/books/{item_id}','OK','204 ; tous les livres temporaires supprimés, liste finale vide.')
e('GET','/api/v1/books/{item_id}','OK','200 sur livres du test ; 404 UUID nul (aperçu Kindle).','MCP')
e('PATCH','/api/v1/books/{item_id}','DÉFAUT','200 métadonnées et page_count:null ; title:null produit 500, F05.')
e('GET','/api/v1/books/{item_id}/deliveries','OK','200 liste vide pour un vrai livre ; aucun historique positif créé.')
e('POST','/api/v1/books/{item_id}/download-link','OK','200, URL signée puis téléchargement 200 ; format original EPUB.','MCP')
e('GET','/api/v1/covers/{item_id}','OK','200 image sur livre avec couverture ; 404 sans couverture.','Web (proxy image)')
e('GET','/api/v1/deliveries','OK','200 liste vide initiale/finale ; pas de livraison réelle.')
e('POST','/api/v1/deliveries','NON VÉRIFIABLE','400 pour dropbox sur Kindle ; rejet cohérent. Aucun envoi SMTP/cloud/code court créé.')
e('GET','/api/v1/deliveries/{job_id}','NON VÉRIFIABLE','404 sur UUID nul ; aucun job du compte à lire positivement.')
e('GET','/api/v1/devices','OK','200 vide puis deux créations successives visibles.')
e('POST','/api/v1/devices','OK','201 ; Kindle avec adresse autorisée, tier A calculé.')
e('DELETE','/api/v1/devices/{device_id}','OK','204 puis liste vide.')
e('GET','/api/v1/devices/{device_id}','OK','200 ; identité, adresse, tier et preset relus.')
e('PATCH','/api/v1/devices/{device_id}','DÉFAUT','200 nom/preset/null du preset ; brand:null produit 500, F05.')
e('GET','/api/v1/devices/{device_id}/link','DÉFAUT','503 Dropbox et Drive : identifiants client absents, F08.')
e('GET','/api/v1/devices/{device_id}/link/callback','NON VÉRIFIABLE','302 sans code/state, comportement de refus attendu ; pas de consentement fournisseur.','Navigateur retour OAuth')
e('POST','/api/v1/devices/{device_id}/link/callback','NON VÉRIFIABLE','400 provider=invalid ; échange valide impossible sans OAuth.','Aucun appelant produit trouvé ; compatibilité API explicite')
e('GET','/api/v1/devices/{device_id}/methods','OK','200 ; email disponible avec adresse Kindle connue.')
e('GET','/api/v1/downloads/{token}','OK','200, 1213 octets EPUB pour le jeton signé créé ; aucun Bearer nécessaire.','Lien rendu par MCP, ouvert par utilisateur')
e('GET','/api/v1/gateways','OK','200 ; pending/paired visibles, vide après nettoyage.')
e('POST','/api/v1/gateways','OK','201 ; secrets réellement utilisés pour appairer.')
e('GET','/api/v1/gateways/jobs/{job_id}','OK','200 ; pending puis done avec library_item_id ; search done aussi lu.')
e('POST','/api/v1/gateways/jobs/{job_id}/fetch-result','OK','200 ; imports EPUB réels, dont deux successifs sur même gateway. Ancien défaut absent.','Gateway worker')
e('POST','/api/v1/gateways/jobs/{job_id}/search-results','OK','200 sur job search ; résultat ressort dans books/search. 409 si mauvais type fetch.','Gateway worker')
e('POST','/api/v1/gateways/pair','OK','200 avec secret courant ; 400 avec ancien secret après rotation.','Gateway worker')
e('POST','/api/v1/gateways/poll','DÉFAUT','204 sans job, 200 avec job, 401 clé révoquée : fonctionnement OK, 204 absent du contrat F07.','Gateway worker')
e('POST','/api/v1/gateways/revoke','OK','200 ; ancienne clé refusée 401 ensuite.')
e('DELETE','/api/v1/gateways/{gateway_id}','OK','204 ; gateways et jobs liés nettoyés.')
e('GET','/api/v1/gateways/{gateway_id}/jobs','OK','200, listes vide puis fetch avec statut et tentatives.')
e('POST','/api/v1/gateways/{gateway_id}/recreate','OK','200 pending/révoquée ; 409 paired est une protection intentionnelle.')
e('GET','/api/v1/mail/settings','OK','200 ; configured=true, adresse expéditeur, domaines, quotas 30/h et 80/j.')
e('GET','/api/v1/opds/tokens','OK','200 ; liste sans secret, vide après révocation.')
e('POST','/api/v1/opds/tokens','OK','201 ; jeton créé ouvre un catalogue 200.')
e('POST','/api/v1/opds/tokens/revoke','OK','200 ; catalogue révoqué 404, aucun jeton actif restant.')
e('GET','/api/v1/sources','OK','200 ; sources initiales identiques après nettoyage complet.')
e('PATCH','/api/v1/sources/{source_id}','OK','200 ; false puis true, restauration contrôlée.')
e('GET','/api/v1/users/me','OK','200 ; bon compte et profil final identique à initial.')
e('PATCH','/api/v1/users/me','DÉFAUT','200 changement/effacement/restauration ; default_format:null produit 500, F05 ; corps générique F07.')
for p in ['/c/{code}','/c/{code}/download']:e('GET',p,'NON VÉRIFIABLE','Non appelé : aucun code de livraison tier C existant ; aucun code inventé.','Navigateur liseuse via lien de livraison')
for p in ['/health','/healthz']:e('GET',p,'NON VÉRIFIABLE','Public : 307 vers /fr'+p+' puis 404. Interne conteneur : 200 ; état ok, Calibre disponible pour healthz.','Healthcheck Docker / exploitation')
for p in ['/opds/{token}','/opds/{token}/all','/opds/{token}/author','/opds/{token}/authors','/opds/{token}/opensearch.xml','/opds/{token}/recent','/opds/{token}/search']:
 e('GET',p,'DÉFAUT','200 XML servi, mais OpenAPI annonce application/json : F07. Catalogue/filtres testés avec jeton actif.','Client OPDS via liens du catalogue')
e('GET','/opds/{token}/cover/{item_id}','OK','200 image réelle ; 404 sans couverture. Métadonnées de réponse OpenAPI trop génériques (voir F07).','Client OPDS')
e('GET','/opds/{token}/download/{item_id}','OK','200 fichier EPUB ; format original. Contrat de réponse non typé (voir F07).','Client OPDS')
assert len(E)==55
for p,ms in ops.items():
 for m in ms:
  v,proof,caller=E[(m.upper(),p)];lines.append(f'| {m.upper()} | `{p}` | {v} | {proof} | {caller} |')
lines+=['', '### Appelants inverses et champs de réponse non exploités','',
'Les références concrètes sont conservées dans [callers-web.txt](callers-web.txt) et [callers.txt](callers.txt). Les fichiers TypeScript générés ne constituent pas un appelant. L’agent gateway appelle pair/poll/search-results/fetch-result ; son watcher utilise upload. Les routes OPDS, téléchargement signé et tier C sont consommées par des liens, pas nécessairement par un fetch JavaScript.','',
'| Famille de réponse | Champs peu ou pas exploités par le MCP | Autre utilisation / conclusion |','|---|---|---|',
'| ResultOut | magnet_url, guid, indexer_id, seeders, isbn, cover_url, language, description, page_count | Le web repasse le résultat complet à books ; le MCP ne le repasse pas : F01. seeders/indexer_id sont présents mais aucune lecture explicite utile par le MCP ; le worker utilise la référence de téléchargement. |',
'| LibraryItemOut | cover_url, source_id, added_at, description, language, page_count, size_bytes, isbn, publisher, published_year, source_ref selon outil | Le web affiche détails/couverture/taille/date ; source_ref sert aux filtres de bibliothèque. Les mises à jour MCP rendent language/isbn mais pas toutes les valeurs modifiées. Aucun livre invisible à cause d’une clé mal nommée trouvé. |',
'| DeviceOut | email_address, conversion_profile, last_synced_at dans list/get | email_address est lu par plan_delivery/deliver_to_kindle ; le web lit last_synced_at et le preset. Affichage MCP volontairement résumé, réinitialisation du preset limitée par F02. |',
'| DeliveryOut | item_author, library_item_id, device_id selon outil | item_author est affiché par le web ; identifiants utilisés pour relations. download_url est optionnel, principalement renvoyé à la création tier C ; sa persistance en lecture n’est pas garantie par le code et reste non testée. |',
'| GatewayCredentials / GatewayOut | pairing_token_ttl_minutes, gateway_online_seconds | Le web utilise ces valeurs pour échéance et état en ligne ; le MCP n’affiche que pairing_expires_at et last_seen_at. Pas de perte de secret ni de confusion id observée. |',
'| GatewayJobStatusOut | payload | Le web lit payload pour son sous-titre ; le worker l’utilise pour exécuter le job. get_gateway_job se limite au suivi, conformément à sa promesse. |',
'| SourceOut | created_at | Aucune lecture explicite trouvée dans les outils MCP ni la vue des sources web ; champ d’information inutilisé, pas une panne. |',
'| UserOut / MailSettingsOut / OpdsToken* / DownloadLinkOut | Aucun champ nécessaire oublié | Valeurs nécessaires lues, secret OPDS uniquement à la création ; pagination repose sur items,total,page, limit restant connu du demandeur. |','',
'Le **POST callback cloud** n’a pas d’appelant produit trouvé : le web passe par le GET callback, le code annonce explicitement conserver le POST pour les clients API. Ce n’est pas un endpoint cassé par son absence d’appelant interne. La branche multipart historique de POST /books n’est plus l’upload du web ; la route dédiée /upload est utilisée. Aucune suppression de ces compatibilités n’est proposée sans décision opérateur.','',
'## 4. Défauts reproduits','']
(R/'REVUE-FONCTIONNELLE.md').write_text('\n'.join(lines)+'\n')
print('report skeleton:',len(lines),'lines')
