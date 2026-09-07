# ADR 0004 — Calibre dans l'image core

- **Statut** : accepté
- **Date** : 2026-09-07
- **Ticket** : FA-W26

## Contexte

Sans Calibre, les conversions échouaient ou retombaient **silencieusement** sur un autre format (ex. PDF au lieu d'AZW3). Le produit mentait sur ce qu'il livrait.

## Décision

**Option (a)** : installer `calibre-bin` dans l'image **core**. Pas de worker de conversion dédié en v1. Fallbacks silencieux interdits : échec → job `failed` + message non-tech, jamais un format inattendu. `/healthz` expose la capacité `ebook-convert`.

## Conséquences

- Image core plus lourde (~centaines de Mo).
- Une seule image à déployer / surveiller.
- Promesse de conversion (tiers A/B, profils W-27) tenable en prod.

## Alternatives écartées

- **Option (b) : worker `ferry-agent/converter` + HTTP interne** — plus propre à long terme, mais service et contrat supplémentaires. Réservé au jour où les conversions longues/fréquentes (profils) le justifient.
- **Garder l'image légère sans Calibre** — conversion cloud / AZW3 cassée ; inacceptable.
