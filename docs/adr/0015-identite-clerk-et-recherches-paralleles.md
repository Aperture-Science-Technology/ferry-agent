# ADR 0015 — Identité Clerk et recherches parallèles

- **Statut** : accepté
- **Date** : 2026-10-08
- **Ticket** : FA-IDENTITY-SUB-01

## Contexte

Le web et le MCP retrouvaient une même personne par deux clés différentes.
Les recherches additionnaient les délais des catalogues puis des gateways.

## Décision

Les deux voies authentifiées utilisent le sujet Clerk vérifié, stocké dans
`users.clerk_sub`, nullable et muni d'un index unique. Une ligne déjà liée est
prioritaire. L'adoption d'une ancienne ligne est permise seulement si son email
est exactement ce sujet et si elle n'est liée à aucun autre sujet. Aucun compte
n'est fusionné par adresse email. Le mode sans sujet conserve la résolution historique.
L'assertion MCP exige un sujet, mais accepte l'absence d'email.

La migration 0018 supprime la contrainte `users_email_key` creee par 0001.
L'email est un attribut d'affichage : plusieurs comptes peuvent partager la
meme adresse. L'index non unique `ix_users_email` est conserve. Les recherches
historiques par email (mode dev et repli sans sujet), ainsi que l'adoption,
choisissent la ligne admissible de plus petit UUID (`ORDER BY id LIMIT 1`).
La resolution par sujet reste prioritaire et unique.

Les connecteurs sont interrogés avec `asyncio.gather`, en conservant leur ordre
de déclaration et l'isolation des erreurs. Les jobs gateway sont créés avant
la recherche légale ; leur attente se déroule en parallèle de celle-ci. Une
seule coroutine accède à la session SQL pendant cette attente. Les délais de
présence et d'attente gateway ne changent pas. Gutendex garde la priorité, avec
une seule tentative de deux secondes avant le repli HTML.

## Conséquences

Les rattachements restent sur leur ligne d'origine. Les créations concurrentes
d'un même sujet sont arbitrées par l'index unique et un savepoint. Les tests de
migration et de résolution s'exécutent uniquement sur des bases Postgres jetables.
La latence tend vers la branche la plus lente au lieu de la somme des branches.

La migration ne modifie les donnees que pour le backfill
`clerk_sub = email WHERE email LIKE 'user_%'`. Aucun compte n'est supprime,
fusionne ou reaffecte. L'application peut ensuite donner un email lisible a
la ligne historique meme si une autre ligne porte deja cette adresse.

Le downgrade restaure `UNIQUE(email)` avant de retirer `clerk_sub`. En presence
d'emails en doublon, il echoue explicitement sans modifier les donnees ni le
schema. Il ne tente aucune correction automatique des comptes pour permettre
le retour en arriere. Sans doublon, il restaure `users_email_key` et conserve
`ix_users_email`.

## Alternatives écartées

- Identifier ou fusionner par email : risque de rattacher les données d'une autre personne.
- Adopter une ligne déjà liée à un autre sujet : risque de changer son propriétaire.
- Diminuer les délais gateway : changement fonctionnel hors périmètre du ticket.
- Restituer les résultats dans l'ordre d'arrivée : résultat instable entre recherches.
