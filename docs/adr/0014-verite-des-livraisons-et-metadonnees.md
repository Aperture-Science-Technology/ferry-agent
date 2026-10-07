# ADR 0014 — Noms publics, métadonnées et fin de livraison

- **Statut** : accepté
- **Date** : 2026-10-07
- **Ticket** : FA-DELIVERY-TRUTH-01

## Contexte

Le nom de stockage fuit dans les pièces jointes. Les imports gateway gardent
les noms de release sans lire les livres. Le web traite tout `sent` comme actif,
alors que l'ADR 0010 définit cet état comme terminal pour l'email.

## Décision

- Centraliser le nom public déterministe dans `library.user_facing_filename`,
  sans modifier le stockage ni les conversions ; repli neutre `Document`.
- Lire les EPUB avec la bibliothèque standard, avec des limites de taille.
  Préserver les métadonnées renseignées. Un titre absent ou un nom de release
  reconnaissable est un repli : OPF, puis release nettoyée, puis valeur initiale.
- Conserver la couverture PNG/JPEG à côté du livre, avec une URL relative
  `/api/v1/covers/{id}`. Le proxy authentifié et le catalogue OPDS résolvent ce
  marqueur exact ; aucune ouverture d'un chemin local fourni par cette URL.
  Supprimer la couverture avec le livre. Le cache distant existant reste inchangé.
- Réutiliser PyMuPDF déjà déclaré pour les titres, auteurs et pages PDF ;
  ne pas confondre la date de création du fichier avec une publication.
  Ne renseigner les pages EPUB
  que si une étendue explicite en pages est présente dans les métadonnées.
- Ajouter `terminal` calculé dans la réponse API, sans migration. Le web se
  fonde sur ce champ ; une valeur inconnue ou absente ne vaut jamais confirmation.
- Les deux variables Prowlarr explicites remplacent les identifiants sauvegardés ;
  sinon conserver ceux-ci, puis générer au premier démarrage. Le lecteur Forms
  utilise le fichier contenant ces valeurs effectives, sans exposer les secrets.

## Conséquences

Les trois voies de livraison ont un nom lisible et stable. L'acceptation email
ne compte plus comme un transfert en cours et n'est pas une preuve de réception
Kindle. Les couvertures locales ne dépendent pas du cache temporaire ni d'un
service externe. L'import reste utilisable si les métadonnées sont illisibles.
Les anciennes entrées ne sont pas réécrites automatiquement. Les couvertures
SVG ne sont pas servies depuis l'EPUB. Les métadonnées absentes ou les PDF
illisibles/chiffrés restent sans enrichissement.

## Alternatives écartées

- Retirer l'UUID du nom disque : collision et dépendance au nom de release.
- Ajouter un parseur PDF lourd ou un service de recherche bibliographique :
  dépendance inutile et risque d'attribuer les métadonnées d'un autre ouvrage.
- Mettre les couvertures EPUB uniquement dans le cache temporaire : perte
  possible sans source HTTP permettant de les télécharger de nouveau.
- Déduire l'état terminal dans chaque composant : divergence API/web.
