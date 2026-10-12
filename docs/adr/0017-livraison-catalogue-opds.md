# ADR 0017 — Livraison par catalogue OPDS et fin du cul-de-sac du tier D

- **Statut** : accepté
- **Date** : 2026-10-11
- **Ticket** : FA-DEVICE-DELIVERY-01

## Contexte

Le routage de livraison suit le tier de la liseuse : A (email Kindle), B (cloud Dropbox/Drive), C (mini-catalogue HTTP par code court), D (aucun mode). Toute marque non Kindle/Kobo — dont PocketBook, pourtant dotée d'un lecteur OPDS natif — tombait en tier D et n'avait **aucun** mode de livraison : un cul-de-sac fonctionnel silencieux.

## Décision

Une méthode de livraison `opds` est ajoutée à l'énumération `DeliveryMethod` (migration 0019, `ALTER TYPE ... ADD VALUE IF NOT EXISTS`, exécutée hors transaction par `autocommit_block`).

- Le tier **C** propose `browser_code` **et** `opds` ; le tier **D** propose `opds` au lieu d'une liste vide.
- `pocketbook` est traité **explicitement** (tier D) au lieu de résulter d'une chute par défaut : le comportement est lisible dans le calcul de tier.
- Une livraison `opds` **réutilise** un jeton OPDS non révoqué portant le libellé de l'appareil, sous verrou de ligne sur l'utilisateur pour éviter la création concurrente de doublons ; sinon elle en crée un. L'URL publique du catalogue est renvoyée dans `download_url`, le job passe en `sent` — même sémantique que le tier C : *prêt à récupérer*, pas *lu sur la liseuse*.
- Le jeton est conservé chiffré (`opds_tokens.token_encrypted`, Fernet) pour que le lien reste retrouvable ; s'il a été créé avant cette migration, la livraison renvoie un message actionnable demandant de révoquer puis relancer, plutôt qu'un échec muet.
- L'annulation d'une livraison et la relance d'un échec utilisent un **verrou consultatif Postgres** par job : une annulation ne peut pas courir contre un envoi déjà commencé.

## Conséquences

- Un appareil `other` ou `pocketbook` reçoit désormais un accès catalogue utilisable, sans nouvelle mécanique de fichier.
- Le catalogue expose **toute** la bibliothèque de l'utilisateur au porteur du lien : c'est le comportement attendu d'un lecteur OPDS, et le jeton reste révocable depuis les Réglages.
- Le `downgrade` de la migration est un no-op documenté : Postgres ne sait pas retirer une valeur d'énumération, et la suppression des colonnes ajoutées détruirait des données.

## Alternatives écartées

- **Basculer PocketBook en tier C** — le navigateur embarqué existe, mais le lecteur OPDS natif est la voie normale ; un code court par livre est un détour.
- **Créer un jeton par livraison** — accumule des jetons et brouille la révocation ; la réutilisation par libellé d'appareil garde un accès par liseuse.
- **Réutiliser le jeton OPDS global de l'utilisateur** — mélange les accès et empêche de révoquer la seule liseuse concernée.
