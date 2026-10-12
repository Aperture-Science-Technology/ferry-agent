# ADR 0016 — Filtres, tri et pagination de la recherche

- **Statut** : accepté
- **Date** : 2026-10-11
- **Ticket** : FA-SEARCH-QUERY-01

## Contexte

`POST /api/v1/books/search` n'acceptait que `query` et `scope` et renvoyait une liste plate. L'utilisateur ne pouvait ni restreindre par langue, format, auteur ou provenance, ni trier, ni paginer ; et l'interface ne pouvait pas exprimer un besoin de recherche précis. Les résultats proviennent de deux familles hétérogènes — catalogues légaux (Gutenberg, Standard Ebooks) et gateways personnelles via Prowlarr — dont les filtres natifs diffèrent.

## Décision

`SearchRequest` accepte trois champs optionnels supplémentaires : `filters` (`language`, `formats`, `author`, `sources`, `owned`, `min_seeders`, `max_size_bytes`), `sort` (`relevance`, `title`, `author`, `size`, `seeders`), `limit` (1–200) et `offset`. **Le modèle de réponse ne change pas** : la route continue de renvoyer `list[ResultOut]`, ce qui préserve le web, le MCP et les clients existants.

Le filtrage, le tri et la fenêtre sont appliqués **côté cœur** (`services/library.filter_search_results`), après le calcul du drapeau `owned` — cet ordre est nécessaire pour que `owned` soit un filtre et non une propriété d'affichage. Les chaînes sont comparées sans casse ni accents. Le tri `size` et `seeders` est décroissant, les valeurs absentes en dernier.

Les filtres sont **transmis dans la charge utile du job gateway** pour que l'agent Prowlarr restreigne en amont ; l'agent applique localement `min_seeders` et `max_size_bytes` et journalise tout filtre non supporté, sans jamais journaliser de valeur d'entrée libre. L'outil MCP `search_library` expose les mêmes critères.

Côté interface, les critères sont sérialisés dans l'URL et rejoués : une URL partagée reproduit la même liste.

## Conséquences

- Comportement par défaut inchangé : sans nouveau champ, la réponse est identique à avant.
- Le filtrage des résultats légaux se fait après collecte : un filtre très restrictif ne réduit pas la charge réseau vers Gutenberg ou Standard Ebooks.
- `openapi.json` et `web/lib/api-types.generated.ts` doivent être régénérés à chaque évolution du schéma (la CI échoue sinon).

## Alternatives écartées

- **Nouvelle route `/books/search/advanced` renvoyant une enveloppe paginée** — duplique le contrat et casse les appelants existants ; une enveloppe aurait exigé de modifier web et MCP simultanément.
- **Filtrage délégué entièrement aux connecteurs** — Gutendex et Standard Ebooks n'exposent pas les mêmes critères ; le résultat aurait été incohérent selon la source.
- **Filtrage côté client uniquement** — impossible au-delà de la première page de résultats et faux dès que la liste est tronquée.
