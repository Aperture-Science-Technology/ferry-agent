# ADR 0003 — Suppression du compte-service MCP

- **Statut** : accepté
- **Date** : 2026-09-07
- **Ticket** : FA-W04

## Contexte

Le serveur MCP pouvait appeler le core via `MCP_API_KEY` (compte service). Les outils n'agissaient donc pas toujours au nom de l'utilisateur Clerk réel — risque d'identité floue et de contournement d'auth.

## Décision

Supprimer le fallback compte-service : plus de `MCP_API_KEY`. L'auth Clerk (JWT utilisateur) est **obligatoire** ; absence de token → 401. Les tools MCP transmettent le JWT du user réel au core.

## Conséquences

- Une seule identité de bout en bout (MCP → core).
- Déploiements / `.env` doivent retirer `MCP_API_KEY`.
- Les tests MCP mockent un JWT Clerk, plus une clé service.

## Alternatives écartées

- **Conserver MCP_API_KEY pour jobs batch** — hors périmètre v1 ; trop risqué si exposé.
- **Double auth (JWT ou clé)** — laisse le trou ouvert ; c'est exactement le bug à fermer.
