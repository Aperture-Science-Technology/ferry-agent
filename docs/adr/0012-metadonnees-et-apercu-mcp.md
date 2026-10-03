# ADR 0012 — Métadonnées et aperçu de livraison MCP

- **Statut** : accepté
- **Date** : 2026-10-03
- **Ticket** : FA-MCP-FIX-AUDIT-01

## Contexte

Le MCP perdait les métadonnées de recherche à l'import et annonçait un format
Kindle différent de celui produit par le cœur. Il doit rester un wrapper REST.

## Décision

Pour F01, la recherche MCP restitue le résultat complet dans son contenu
structuré `results`. L'ajout transmet le résultat choisi dans `result`, comme
le web. Il refuse les résultats absents, sans titre ou dont les identifiants
ne correspondent pas. Aucun champ bibliographique absent n'est inventé.

Pour F03, `GET /api/v1/deliveries/preview` vérifie l'appartenance du livre et de
la liseuse puis appelle le résolveur utilisé par la livraison. Les deux
aperçus MCP utilisent cette route pour chaque liseuse. Le cœur applique la
règle Send-to-Kindle au tier A, conformément au routage de la livraison.

## Conséquences

Les sources légales et les gateways conservent leurs métadonnées sans cache
MCP partagé entre utilisateurs ni accès MCP à la base. Un appelant MCP doit
transmettre le résultat de recherche ; les anciens appels avec seulement
source/result_id reçoivent une explication au lieu de persister un faux titre.
Le flux web reste compatible. L'aperçu ajoute une lecture REST par liseuse,
sans créer de job, convertir de fichier ou consommer de quota d'envoi.

## Alternatives écartées

La résolution des métadonnées par le cœur protégerait aussi les autres clients,
mais demanderait des résolveurs par source et une stratégie de conservation des
résultats gateway. La transmission exploite le contrat REST existant pour toutes
les sources, avec un refus explicite si les données nécessaires manquent.
Un cache MCP introduirait expiration, isolation et dépendance au processus.
Recopier les règles de format dans le MCP maintiendrait deux vérités divergentes.
