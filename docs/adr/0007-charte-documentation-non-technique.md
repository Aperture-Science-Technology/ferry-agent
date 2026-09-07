# ADR 0007 — Charte documentation non-technique (Décision B)

- **Statut** : accepté
- **Date** : 2026-09-07
- **Ticket** : FA-W31 (Décision B du plan)

## Contexte

Le public cible d'installation et du dashboard n'est **pas** développeur. Un guide plein de jargon (`conteneur`, `healthcheck`, `tarball OCI`) ou de commandes à trous fait échouer l'onboarding même si le binaire est correct.

## Décision

Tout texte **utilisateur final** (Guide, Accès, toasts, empty states, erreurs affichées, i18n) respecte la charte :

1. Langage simple — interdit : conteneur, volumes nommés, endpoint, healthcheck, tarball OCI, RPC, FK, migration…
2. Libellés UI réels (OrbStack / Docker Desktop) repris tels quels ; valeurs à coller = données, pas jargon.
3. Étapes numérotées (un pas = une action visible).
4. Guide de choix en tête (parcours GUI d'abord).
5. Erreurs / dépannage en mots simples.
6. Minimum de commandes, toujours pré-remplies, jamais à éditer.
7. Risques expliqués par la conséquence (ex. port 9696).

`fr.json` / `en.json` restent strictement symétriques. README / `--help` opérateur peuvent rester techniques.

## Conséquences

- Revue de chaque ticket UI inclut la charte.
- Moins de surface « tutos à trous » ; alignement avec ADR 0005.
- Effort rédactionnel plus élevé sur les clés i18n.

## Alternatives écartées

- **Docs techniques pour power users uniquement** — abandonne le public principal.
- **Deux guides (tech / non-tech) sans priorité** — le mauvais est toujours cliqué en premier.
- **Jargon « pour être précis »** — précision illusoire si l'utilisateur n'installe pas.
