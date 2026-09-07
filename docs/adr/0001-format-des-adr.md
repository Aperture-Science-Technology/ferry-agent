# ADR 0001 — Format des ADR

- **Statut** : accepté
- **Date** : 2026-09-07
- **Ticket** : FA-W31

## Contexte

Le dépôt n'avait aucun canal pour figer les arbitrages structurants. Les décisions se perdaient dans des messages de commit ou des plans hors repo ; chaque revue devait les redécouvrir.

## Décision

Chaque décision d'architecture **prise** est consignée dans `docs/adr/NNNN-titre.md` avec exactement quatre sections :

1. **Contexte** — problème et contraintes
2. **Décision** — choix retenu
3. **Conséquences** — effets positifs et négatifs
4. **Alternatives écartées** — options rejetées et pourquoi

Numérotation séquentielle à quatre chiffres. Un ADR référence le ticket `FA-WXX` qui l'a tranché. Les ADR sont courts (une page).

## Conséquences

- Les agents et humains ont une source de vérité versionnée.
- Une décision différée n'est **pas** un ADR : elle va en `# TODO(FA-XXX):` dans le code (voir `AGENTS.md`).
- Coût marginal : rédiger l'ADR avant de merger la décision.

## Alternatives écartées

- **Docstrings de module seules** — utiles localement, invisibles pour les arbitrages transverses.
- **Wiki / plan hors repo** — non versionné avec le code, hors CI.
- **ADR longs type MADR complet** — trop lourds pour un rythme ticket-par-ticket.
