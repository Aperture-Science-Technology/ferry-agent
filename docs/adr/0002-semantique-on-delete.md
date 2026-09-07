# ADR 0002 — Sémantique ON DELETE (books / devices)

- **Statut** : accepté
- **Date** : 2026-09-07
- **Ticket** : FA-W02

## Contexte

Sans `ondelete` sur les FK, `DELETE /books` et `DELETE /devices` provoquaient des `IntegrityError` → 500 dès qu'il existait des livraisons ou short codes liés. Le code documentait une règle métier que le schéma Postgres interdisait.

## Décision

Sémantique FK (migration `0009`) :

| FK | Règle |
|---|---|
| `delivery_jobs.library_item_id` | `nullable` + `ON DELETE SET NULL` (+ `item_title` / `item_author` dénormalisés) |
| `short_codes.delivery_job_id` | `ON DELETE CASCADE` |
| `delivery_jobs.device_id` | `ON DELETE CASCADE` |
| `gateway_jobs.gateway_id` | `ON DELETE CASCADE` |
| `library_items.source_id` | `ON DELETE SET NULL` |
| `*.user_id` (devices, library_items, sources, gateways) | `ON DELETE CASCADE` |

L'historique de livraison survit à la suppression d'un livre ; il disparaît avec l'appareil.

## Conséquences

- Suppression livre / appareil : 204, plus de 500.
- Purges manuelles dans les services devenues redondantes (CASCADE).
- Lecture de l'historique après SET NULL dépend des colonnes dénormalisées.

## Alternatives écartées

- **CASCADE partout** — effacerait l'historique livraisons avec le livre, contraire à l'intention produit.
- **Soft-delete uniquement** — ne règle pas les FK actuelles et complexifie toutes les requêtes.
- **Purge applicative sans `ondelete`** — fragile, déjà source des 500 constatés.
