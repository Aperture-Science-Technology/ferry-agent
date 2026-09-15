# 04 — Interactions, états et mouvement

## 1. Règles communes — R

1. Chaque action a un effet visible proche du contrôle déclencheur.
2. Les données restent lisibles pendant leur actualisation ; afficher leur ancienneté si elle est pertinente.
3. Le succès n’est annoncé qu’après confirmation de l’opération concernée. Une requête acceptée n’est pas une lecture confirmée sur liseuse.
4. Un échec ne vide pas silencieusement les données déjà connues et ne détruit pas la saisie.
5. Une erreur persistante reste dans la page ou le formulaire ; un toast complète cette information.
6. Le clavier et le toucher permettent les mêmes actions que la souris.

## 2. Matrice des états et retours

| Situation | Présentation cible | Action / accessibilité |
|---|---|---|
| Lecture initiale | Skeleton dimensionné comme le contenu, libellé de chargement unique | Région `aria-busy` ; décorations de skeleton non annoncées |
| Collection vide | Message spécifique à l’objet, petite illustration, CTA de départ | Titre et action nommés ; pas de faux tableau vide |
| Aucun résultat de filtre | Compteur nul et filtres encore visibles | « Effacer les filtres » ; préserver la saisie |
| Recherche externe sans résultat | Message reprenant l’intention, suggestion titre/auteur | Nouvelle recherche possible sans rechargement |
| Données indisponibles | Message d’erreur dans la zone concernée | « Réessayer » seulement si cela relance effectivement une lecture |
| Données partielles | Contenu acquis + avertissement et état incomplet | Pas de total présenté comme complet ; recharger la partie manquante |
| Mutation en cours | Bouton occupé avec libellé conservé, double soumission empêchée | Ne pas retirer le bouton focalisé du DOM |
| Validation échouée | Erreur sous le champ, saisie conservée | `aria-invalid`, `aria-describedby`, focus premier champ invalide |
| Action réussie | Mise à jour locale confirmée, retour bref | `role=status` ou annonce polie unique |
| Résultat incertain | Explication sans affirmer échec ou succès | Vérifier l’état avant de reproposer une mutation |
| Action destructive | Nom de l’objet, conséquence concrète, confirmation distincte | Focus initial sur l’action non destructive, retour au bon élément |
| Session interrompue | Accès à la reconnexion selon le flux Clerk | Préserver seulement le contexte non sensible ; pas de secrets dans l’URL |

**F :** les briques `Alert`, `Skeleton`, `StatePanel`, `EmptyState` et Sonner sont présentes (`web/components/ui/alert.tsx`, `skeleton.tsx`, `sonner.tsx`, `web/components/app/state-panel.tsx`, `empty-state.tsx`). **R :** leur existence ne garantit pas la bonne sémantique de chaque montage ; adapter les écrans et leurs annonces.

## 3. Focus et navigation — R

- Ajouter un lien d’évitement vers le contenu, une navigation nommée et un état courant `aria-current="page"` sur le lien actif.
- Le bouton de menu expose son nom traduit, son état ouvert et sa relation au panneau. À la fermeture sans navigation, rendre le focus au déclencheur.
- Lors d’un changement de page depuis le volet mobile, fermer celui-ci ; rendre le nouveau titre perceptible sans renvoyer arbitrairement l’utilisateur au début du document.
- Dialog : titre, description utile, focus initial prévisible, Tab contenu dans la surface, Échap pour fermer sauf opération indivisible justifiée, focus restauré à la sortie.
- Ne pas transformer une carte contenant plusieurs actions en bouton englobant. Prévoir un vrai bouton/lien « Détails de [titre] » et conserver les actions distinctes.
- Nommer les boutons icône : copier le lien, fermer, grille/liste. Les tooltips complètent le nom accessible et ne le remplacent pas.
- Les labels sont associés aux champs, même lorsque Base UI gère leur interaction ; une valeur sélectionnée seule ne remplace pas le nom du champ.
- Donner un équivalent clavier au glisser-déposer ; conserver l’ouverture du sélecteur de fichiers et un focus visible.

**F :** la dropzone gère déjà Entrée/Espace (`web/components/app/library/upload-dropzone.tsx`), mais les primitives de fermeture et sidebar contiennent des noms anglais fixes (`web/components/ui/dialog.tsx`, `sheet.tsx`, `sidebar.tsx`). Les corriger par une interface de traduction compatible avec les usages existants, pas par duplication des primitives.

La cible est WCAG 2.2 AA : ordre du focus, utilisation au clavier, noms des contrôles, messages de statut, reflow à 320 CSS px, absence de focus masqué, taille minimale de cible selon les exceptions applicables. Cible de confort produit : 44 × 44 px pour les actions tactiles fréquentes. Référence : [WCAG 2.2, guide de vérification](https://www.w3.org/WAI/WCAG22/quickref/).

## 4. Contrat de mouvement

**F :** Motion et `useReducedMotion` existent dans `web/components/motion/reveal.tsx` et `web/components/marketing/hero.tsx`. La sidebar, les dialogs/sheets et `StatusDot` emploient aussi des animations CSS (`web/components/ui/sidebar.tsx`, `dialog.tsx`, `sheet.tsx`, `web/components/status-dot.tsx`).

| Interaction | Mouvement recommandé | Durée cible | Réduction des animations |
|---|---|---|---|
| Hover/focus bouton | Couleur/bordure ; pas de déplacement du texte | 100–140 ms | Transition de couleur seule ou immédiate |
| Pression | Variation légère de surface ; déplacement optionnel ≤1 px | 80–100 ms | Aucun déplacement |
| Ouverture dialog | Opacité, translation ≤4 px, pas de zoom marqué | 140–180 ms | Apparition immédiate ou fondu ≤80 ms |
| Volet mobile | Translation courte cohérente avec son côté | 180–220 ms | Affichage immédiat ; focus identique |
| Repli sidebar desktop | Réservation de largeur et panneau synchronisés | 160–200 ms | Pas de transition de largeur |
| Nouvelle ligne confirmée | Fondu discret, sans réanimer toute la liste | 120–180 ms | Apparition directe |
| Recherche/filtre | Remplacement stable, compteur annoncé | ≤150 ms visuellement | Pas de mouvement |
| Progression d’import | Valeur réelle lissée sans dépasser le serveur | 100–160 ms | Valeur directement mise à jour |
| Sections marketing | Opacité + montée ≤8 px, une fois | 220–320 ms | Opacité immédiate ; pas de délai |
| Connexion du Gateway | Icône/statut fixe, confirmation ponctuelle | 120–180 ms | Aucune pulsation |

Courbe cible pour les surfaces : `cubic-bezier(0.2, 0, 0, 1)`. Aucun rebond pour un formulaire ou une alerte. Limiter un éventuel décalage d’apparition à trois ou quatre éléments ; ne pas cascader 200 livres. Le contenu métier essentiel doit être utilisable sans attendre une animation d’entrée.

**R :** appliquer une politique de réduction aux effets Motion **et** aux classes Tailwind/CSS (`motion-reduce`, règles ciblées). Le guide officiel explique les usages de `MotionConfig` et `useReducedMotion` ; l’intégration retenue doit couvrir les effets réellement montés : [Motion — accessibilité](https://motion.dev/docs/react-accessibility). Ne pas ajouter un provider pour le seul principe si une adaptation localisée suffit.

## 5. Interactions métier sensibles

### Importer un livre

**F :** progression XHR, validation extension/taille et retour serveur sont dans `web/components/app/library/upload-dropzone.tsx`.

**R :** distinguer transfert → traitement → livre disponible. Le pourcentage ne concerne que les octets transférés. À 100 %, afficher « Ajout à la bibliothèque… » jusqu’au retour réussi ; pas de progression inventée pour la validation. Chaque fichier garde son état. Un fichier refusé ne masque pas les réussites des autres. L’annonce vocale porte sur les étapes et la fin, pas chaque variation de pourcentage.

### Ajouter depuis une source Gateway

**F :** `web/lib/use-gateway-job.ts` observe toutes les 3 secondes jusqu’à 20 minutes ; `pendingJobs` vit dans `web/components/app/library/library-view.tsx`.

**R :** afficher « Ajout en cours » tant que le serveur n’a pas confirmé ; un délai de suivi dépassé n’est pas la preuve que le téléchargement a échoué. Garder la reprise via l’activité du Gateway. Si une tâche est retrouvée après navigation, s’appuyer sur le contrat existant et préciser toute évolution API nécessaire. Aucun pourcentage de torrent à partir d’un simple statut.

### Lier un compte de destination

**F :** popup, `window.opener`, retour `cloud_link`, `postMessage` filtré par origine, polling de 2 secondes borné à 5 minutes (`web/components/app/devices/cloud-link-dialog.tsx`, `devices-view.tsx`).

**R :** états « Ouverture », « Terminez la connexion dans l’autre fenêtre », « Connexion réussie », « Connexion non terminée ». Si la popup n’a pas pu s’ouvrir, proposer une nouvelle ouverture liée à un geste utilisateur. Ne pas fermer la fenêtre ni modifier le protocole d’échange pour une animation. Aucun appel réel aux fournisseurs requis dans une simple recette de présentation avec fixtures ; la recette OAuth réelle doit être distinguée.

### Copier des secrets ou un lien catalogue

**F :** codes Gateway affichés ensemble dans `web/components/app/gateways/create-gateway-dialog.tsx` ; URL et QR créés à la demande dans `web/components/app/settings/reader-catalog-section.tsx` et `catalog-qr-code.tsx`.

**R :** bouton « Copier les deux codes » ; état « Copié » seulement après succès du presse-papiers. En échec, laisser sélectionner le bloc. Prévenir avant de perdre une valeur affichée une seule fois, sans exposer les secrets dans un toast, la télémétrie ou les captures. Le QR est une représentation du lien réel, jamais une illustration générée. Masquer les vraies valeurs dans les preuves de recette.

### Supprimer/révoquer

**R :** distinguer supprimer l’objet et lui retirer son accès. Confirmation avec le nom réel et la conséquence ; aucune phrase anxiogène générique. Après suppression, focus vers l’élément suivant ou le titre de la liste si elle est vide. Ne pas promettre « Annuler » sans capacité réelle de restauration.

## 6. Tests d’interaction requis pour Cursor

Recettes comportementales : parcourir toute la bibliothèque au clavier ; ouvrir un livre en mode liste mobile ; revenir au bon contrôle après fermeture ; naviguer depuis le volet puis ouvrir un dialog ; copier avec presse-papiers refusé ; laisser une recherche échouer sans perdre la collection ; changer de langue avec un état de page ; tester une description de livre très longue à 200 % de zoom et une page à 400 % ; activer la réduction des animations avant et pendant une session.

Consigner viewport, langue, données, action, résultat attendu, résultat obtenu et capture pertinente. Un scan automatique complète le test manuel, sans démontrer à lui seul l’accessibilité.
