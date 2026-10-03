import pathlib,json,collections
R=pathlib.Path(__file__).resolve().parent
p=R/'REVUE-FONCTIONNELLE.md';s=p.read_text()
changes={
'`mcp-server/ferry_mcp/server.py:432`':'`mcp-server/ferry_mcp/server.py:424`',
'`:446` construit ce corps minimal':'`:437` construit ce corps minimal',
'`src/ferry_agent/services/kindle_formats.py:40`':'`src/ferry_agent/services/kindle_formats.py:33`',
'`api/books.py:451`':'`api/books.py:435`',
'`api/devices.py:167`':'`api/devices.py:169`',
'`api/users.py:66`':'`api/users.py:72`',
'`api/books.py:294`':'`api/books.py:295`',
'`api/books.py:387`':'`api/books.py:385`',
'`api/gateways.py:159`':'`api/gateways.py:150`',
'`api/opds.py:134`':'`api/opds.py:116`',
'`src/ferry_agent/api/devices.py:282` et `:290`':'`src/ferry_agent/api/devices.py:250` et `:258`',
' ; le livre final conserve ce titre.':' ; le payload d’import conserve ce titre.',
'**Sources légales** : recherche légale exécutée, import Gutenberg positif. Pas de résultat Standard Ebooks exploitable obtenu sur cette recherche ; son téléchargement n’est donc pas validé positivement.':'**Sources légales** : recherche légale exécutée (11 résultats Gutenberg, 1 Standard Ebooks) ; imports avec métadonnées positifs pour les deux sources, chacun avec 201 puis lecture 200 et suppression 204. Pas de garantie sur toutes les recherches possibles ni sur la disponibilité future de ces sites.',
'200 ; Gutenberg 1342 et résultat gateway simulé réellement retournés.':'200 ; Gutenberg, Standard Ebooks et résultat gateway simulé réellement retournés.'
}
for a,b in changes.items():s=s.replace(a,b)
created=json.loads((R/'created.json').read_text());logs=[json.loads(x) for x in (R/'http.jsonl').read_text().splitlines()]
s+='\n| Type | Identifiant | Nettoyage observé |\n|---|---|---|\n'
for kind,label,prefix in [('books','Livre','books'),('devices','Liseuse','devices'),('gateways','Gateway','gateways'),('opds','Jeton OPDS','opds/tokens')]:
 for id in created[kind]:
  if kind=='opds':valid=any(x['method']=='POST' and x['path']=='/api/v1/opds/tokens/revoke' and x['status']==200 and x.get('response',{}).get('id')==id for x in logs)
  else:valid=any(x['method']=='DELETE' and x['path']==f'/api/v1/{prefix}/{id}' and x['status']==204 for x in logs)
  assert valid,(kind,id)
  s+=f'| {label} | `{id}` | '+('Révoqué, POST 200 ; absent de la liste active.' if kind=='opds' else 'DELETE 204.')+' |\n'
s+='''
Jobs gateway créés : `adcc93d0-f26d-44ef-afa5-6b20ffce62fd` (fetch), `011499da-7d40-4bfc-b807-f0c4174f3263` (search), `7bf66b50-7240-4177-8f35-6ebc6a69a06e` et `ca497a7a-64e8-4fa0-be9d-13fae8c74f2a` (deux fetch). Ils sont supprimés avec leurs gateways. Aucun job de livraison créé.

L’import gateway a créé la Source `aeac9e9a-f285-4af8-a513-98fe49c2f8de`, que la suppression de gateway ne retire pas automatiquement. Comme aucune route ne supprime une Source, cette seule ligne a été retirée par une transaction ciblée dans le cœur, après vérification de l’UUID, de l’utilisateur test, de sa date de création et de l’absence de livre référent ou de gateway restante. Script et résultat : [cleanup_source.py](cleanup_source.py), [source-cleanup.txt](source-cleanup.txt). Aucune autre Source ni donnée d’un autre utilisateur n’a été touchée.

Le profil a été restauré à kindle_email=null/default_format=epub. La source Gutenberg `700f7897-4ff7-48de-b6d7-534b33cae121`, temporairement désactivée, est réactivée ; les trois sources initiales ont les mêmes identifiants, dates et états. Les jetons OPDS révoqués restent des lignes d’historique côté serveur, conformément à l’API ; **aucun jeton actif** ne subsiste. Les liens de téléchargement des livres supprimés ne donnent plus accès à ces livres.

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
'''
p.write_text(s)
print('created/cleaned', {k:len(v) for k,v in created.items()})
