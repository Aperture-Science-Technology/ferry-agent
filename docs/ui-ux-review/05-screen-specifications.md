# 05 — Spécifications des écrans

Toutes les compositions cibles sont des **R** ; chaque bloc **F** décrit le câblage existant. Appliquer partout les règles de [03](03-art-direction.md) et [04](04-interaction-motion.md), en FR et EN. Les schémas de composition ci-dessous sont textuels, pas des captures.

## S01 — Coque de la webapp

**F — fichiers :** `web/app/[locale]/app/layout.tsx`, `web/components/app/app-sidebar.tsx`, `dashboard-header.tsx`, `page-header.tsx`, `web/components/ui/sidebar.tsx`, `separator.tsx`, `web/hooks/use-mobile.ts`.

- **But :** se situer et changer de rubrique sans perdre les actions du contenu.
- **Composition :** navigation latérale groupée ; header compact avec commande du panneau, langue et compte ; titre et action principale dans la page. Éviter un titre dupliqué dans deux grandes bandes.
- **Responsive :** volet mobile fermé par défaut ; fermer après navigation ; réservation de largeur unique sur desktop ; aucun espace vide résiduel après repli. Tester particulièrement 767/768 px et la largeur utile d’une table à 768 px.
- **États :** lien courant, panneau ouvert/fermé, session chargée/non disponible, langue changée. Restaurer l’état desktop au rechargement si cette préférence est retenue et réellement câblée.
- **Recette :** header sans débordement à 320 px ; titre visible sous un éventuel header sticky ; focus récupéré après Échap ; compte et langue accessibles ; aucune régression du séparateur vertical à hauteur contrainte. Vérifier l’ordre des couches du header, du volet et des dialogs.
- **À préserver :** `auth.protect()`, fournisseurs Clerk/next-intl, URLs et composition Base UI. Aucun remaniement auth requis pour cette tranche.

## S02 — Accueil public

**F — fichiers :** `web/app/[locale]/page.tsx`, tous les composants de `web/components/marketing/`, messages `meta`, `header`, `hero`, `valueProps`, `howItWorks`, `delivered`, `faq`, `mcpSpotlight` dans `web/messages/fr.json` et `en.json`.

**Ordre recommandé :** header → promesse de bibliothèque en ligne → illustration du parcours → trois étapes → méthodes d’envoi avec limites → Gateway complémentaire → assistant IA → FAQ → footer.

- **Action dominante :** « Ouvrir ma bibliothèque » ou libellé cohérent équivalent ; mène à la connexion si nécessaire, à la bibliothèque sinon.
- **Action secondaire :** comprendre le fonctionnement ; guide accessible dans un menu mobile.
- **Texte impératif :** annoncer le service en ligne ; qualifier explicitement le module local. Retirer les promesses « rien n’est stocké chez nous » et « tout reste chez vous ».
- **Illustration :** visuel statique proposé en [06](06-component-and-asset-inventory.md), légendes HTML et alternative textuelle ; aucun asset actuellement supposé présent.
- **États :** visiteur connecté/non connecté ; chargement du contrôle compte sans déplacement majeur ; réduction des animations ; image absente sans perte de sens.
- **Recette :** l’utilisateur comprend qu’il peut commencer sans installation Gateway ; les deux langues disent la même chose ; le header tient à 320 px ; toutes les sections restent accessibles au clavier et par menu mobile.

## S03 — Guide public

**F — fichiers :** `web/app/[locale]/docs/page.tsx`, `web/components/docs/byo-install-guide.tsx`, messages `docs`, `docs/adr/0005-distribution-canal-gui.md`, `docs/adr/0007-charte-documentation-non-technique.md`, `gateway/dist/README.md`, `.github/workflows/ci.yml`.

- **But :** comprendre quoi faire en ligne et quand installer le Gateway.
- **Entrée :** deux parcours nommés « Commencer dans la webapp » et « Installer le Gateway chez vous ». L’assistant IA et le catalogue liseuse ont des renvois clairement identifiés.
- **Gateway :** prérequis, choix de l’architecture vérifié, fichier disponible, étapes GUI validées, copie des deux secrets, constat de connexion dans la webapp, dépannage. Une étape = une action visible.
- **Responsive :** sommaire repliable en haut ; étapes verticales ; blocs de valeurs scrollables/sélectionnables sans faire déborder la page ; ancres tenant compte du header sticky.
- **Recette :** toutes les cibles de liens et ancres existent ; l’ancre de dépannage donne accès au contenu utile ; pas de commande à trous ; aucune affirmation de « quelques minutes » ou d’import GUI sans mesure réelle.
- **Dépendance bloquante du chapitre installation :** le code référence un `.tar` unique alors que le workflow décrit des `.tar.gz` par architecture. Vérifier ce qui est réellement distribué et importable, puis écrire les gestes. Cette revue ne tranche pas par invention d’une URL.

## S04 — Bibliothèque

**F — fichiers :** `web/app/[locale]/app/bibliotheque/page.tsx`, `web/components/app/library/library-view.tsx`, `cover-image.tsx`. Lectures `/api/v1/books?page=…&limit=200`, `/api/v1/devices` ; recherche sources par POST `/api/v1/books/search`.

### Composition remplie

1. Titre, compteur fiable, « Ajouter des livres ».
2. Recherche **dans la collection** si implémentée ; sinon ne pas afficher ce contrôle.
3. Tri, filtres langue/format/source, sélecteur grille/liste.
4. Collection, action Détails explicite et/ou action d’envoi accessible.
5. Information de chargement incomplet et accès à la suite si la pagination est retravaillée.

L’ajout ouvre un espace distinct : « Importer un fichier » / « Rechercher dans les sources ». Conserver les interactions existantes pendant la réorganisation. Les résultats externes ne remplacent pas silencieusement les livres possédés.

### États et comportements

- Collection réellement vide : invitation courte et deux voies d’ajout.
- Impossible de charger : erreur avec lecture à relancer, sans appeler cela une collection vide.
- Données partielles : livres déjà chargés conservés, compteur incomplet annoncé.
- Filtre sans résultat : réinitialisation des filtres ; collection intacte.
- Couverture absente ou échec de récupération : placeholder stable ; titre toujours lisible.
- Réapparition après navigation : expliquer ce qui est conservé ; persister les seuls filtres utiles si retenu, sans stocker de secret.

**Responsive :** une ou deux colonnes de livres selon largeur mobile réelle ; liste compacte conservant toutes les actions ; filtres regroupés dans un panneau nommé sur écran étroit. Ne pas réduire les couvertures à de petits carrés dans toutes les vues : respecter leur ratio ou accepter explicitement le recadrage.

**Recette :** bibliothèque de 0, 1, 30 et >200 livres ; titre de 120 caractères ; auteur absent ; couverture en échec ; échec de page 2 ; changement de langue ; filtre puis navigation retour ; bouton Détails accessible en mode liste mobile. **F :** le proxy authentifié de couverture crée des URL blob et les libère (`cover-image.tsx`) : conserver cette protection et son nettoyage.

## S05 — Import et recherche de nouveaux livres

**F — fichiers :** `web/components/app/library/upload-dropzone.tsx`, `library-view.tsx`, `web/lib/use-gateway-job.ts`, `src/ferry_agent/api/books.py`.

| Flux | Présentation cible | États et recette |
|---|---|---|
| Import | Sélecteur de fichiers aussi visible que la zone de dépôt ; formats et limite ; une ligne par fichier | Format refusé, taille dépassée, quota 507, réseau coupé, progression puis validation, succès partiel d’un lot |
| Recherche sources | Champ nommé « Rechercher dans les sources », bouton Rechercher ; source et format par résultat | Chargement, aucun résultat, erreur, résultat déjà possédé, résultats longs ; empêcher réponses anciennes d’écraser les nouvelles |
| Ajout direct | Bouton lié au résultat ; confirmation puis livre disponible | Double clic empêché ; aucun doublon visuel ; refus du serveur expliqué |
| Ajout Gateway | État de tâche visible et voie de suivi | En attente, en cours, terminé, erreur, délai d’observation dépassé ; aucune progression inventée |

**R :** une erreur de source complémentaire ne doit pas être présentée comme une panne générale de la collection. Si l’API ne fournit pas la distinction nécessaire, noter la limite et traiter cette évolution séparément.

## S06 — Détails, édition et envoi d’un livre

**F — fichiers :** `web/components/app/library/book-detail-dialog.tsx`, `book-edit-dialog.tsx`, `deliver-dialog.tsx`. Historique par `/books/{id}/deliveries`, méthodes par `/devices/{id}/methods`, création par POST `/deliveries` ; types dans `web/lib/types.ts`.

- **Détails :** titre complet, auteur, couverture, format/langue et métadonnées disponibles ; action Envoyer dominante ; Modifier secondaire ; Supprimer séparée. Description longue scrollable et historique compact.
- **Édition :** labels associés, validation proche du champ, saisie conservée en échec ; pas de fermeture avant confirmation serveur.
- **Envoi :** appareil → méthode réellement disponible → format par défaut et choix avancé → récapitulatif → Envoyer. Une méthode unique peut être préchoisie, mais reste compréhensible.
- **Aucun appareil :** CTA « Ajouter un appareil » avec contexte du livre préservé ; ne pas réduire ce cas à un select vide.
- **Méthode indisponible :** expliquer SMTP indisponible ou compte à relier en termes utilisateur ; renvoi contextuel vers Appareils/Réglages selon la cause.
- **Confirmation :** montrer ce qui a été fait et un accès aux Livraisons ; URL de téléchargement utilisable lorsqu’elle est renvoyée. Ne pas utiliser un toast comme seul accès au fichier.
- **Modales :** préférer une transition de contenu contrôlée à une pile de trois fenêtres. Si plusieurs dialogs sont conservés, vérifier le focus et la fermeture de chaque niveau ; pas de remplacement des primitives sans test.
- **Recette :** champ vide, long descriptif, erreur historique distincte d’aucun envoi, méthode changeant avec l’appareil, API 400/507, confirmation de suppression, retour focus, page zoomée avec toutes les actions accessibles.

## S07 — Livraisons

**F — fichiers :** `web/app/[locale]/app/livraisons/page.tsx`, `web/components/app/deliveries/deliveries-view.tsx`, `delivery-detail-dialog.tsx`, `src/ferry_agent/services/delivery.py`, `src/ferry_agent/api/tierc.py`.

- **Composition :** titre, compteur, action « Actualiser » réellement câblée ; liste/table de livre, destination, mode, format, état, date, actions ; détail avec contexte complet.
- **Hiérarchie :** livre et destination dominent ; code technique et identifiant ne sont pas des titres.
- **Actualisation :** d’abord lecture explicite fiable ; polling borné des envois non terminés si retenu. Garder les données pendant une actualisation.
- **Statuts :** attente, envoyé, opération terminée, échec ; préciser le sens selon le canal. `delivered` email/cloud ne prouve pas l’ouverture du livre ; la route de téléchargement marque également ce statut lors du service du fichier.
- **Erreur :** message simple et action contextualisée ; pas de pile technique ni d’erreur brute dans le contenu principal. Ne pas ajouter « Réessayer l’envoi » tant que le contrat et le risque de doublon ne sont pas traités.
- **Responsive :** cartes compactes avec bouton Suivre et téléchargement ; table seulement avec largeur utile suffisante.
- **Recette :** quatre statuts, valeurs enrichies absentes, lien absent, requête de détail échouée, passage d’un statut à l’autre sans rechargement forcé si polling implémenté, cohérence liste/détail. Les dates suivent la locale de l’application.

## S08 — Appareils et liaison de compte

**F — fichiers :** `web/app/[locale]/app/appareils/page.tsx`, `web/components/app/devices/devices-view.tsx`, `new-device-dialog.tsx`, `edit-device-dialog.tsx`, `conversion-profile-field.tsx`, `cloud-link-dialog.tsx`, `brand-badge.tsx`.

- **Composition :** titre + Ajouter un appareil ; identité lisible par nom, marque/modèle secondaires ; méthode et statut de liaison formulés en mots simples ; actions Modifier, Relier si pertinent, Supprimer dans une zone secondaire.
- **Création :** nom facultatif, marque, modèle facultatif ; profil de préparation automatique proposé par défaut, choix avancés explicables. Ne pas afficher les tiers A/B/C comme navigation utilisateur.
- **Liaison :** fournisseur puis ouverture externe ; progression et retour vers l’app ; état d’échec/popup bloquée récupérable. Préserver le protocole décrit dans [04](04-interaction-motion.md).
- **État vide :** une action claire, aucune exigence Gateway généralisée.
- **Recette :** cinq marques prévues par le formulaire, modèle libre pour autre marque, noms longs, aucun compte lié, succès/refus/délai OAuth, fermeture pendant attente, rechargement du retour `cloud_link`, suppression sans altérer la présentation de l’historique restant.
- **Limite :** disponibilité réelle Dropbox/Drive à confirmer dans l’environnement ; l’existence du bouton n’atteste pas une configuration fournisseur opérationnelle.

## S09 — Gateway

**F — fichiers :** `web/app/[locale]/app/gateways/page.tsx`, `web/components/app/gateways/gateways-view.tsx`, `create-gateway-dialog.tsx`, `src/ferry_agent/api/gateways.py`.

- **Titre recommandé :** « Gateway », sous-titre « Le module installé chez vous pour vos sources locales ».
- **Composition :** explication cloud/local courte → liste des modules avec nom/état/dernière connexion → activité → ajout. Le guide est accessible, sans grand panneau d’installation permanent lorsque tout fonctionne.
- **Création :** nom → deux secrets et copie groupée → indication d’affichage unique → attente → connexion confirmée. Se servir des durées renvoyées par l’API lorsqu’elles existent.
- **États :** aucun module, attente, expiration, connecté, hors ligne, révoqué ; activité chargée, vide ou indisponible. Le hors-ligne appelle une action locale et ne bloque pas visuellement la bibliothèque cloud.
- **Actions :** recréer les codes, révoquer, supprimer, consulter le guide ; expliquer leurs conséquences respectives.
- **Polling :** conserver le rythme adapté existant (5 s en attente, 15 s si appairé) et les limites du contrat avant optimisation ; éviter de remplacer les détails par des skeletons à chaque tick (`gateways-view.tsx`).
- **Recette :** expiration dans une page laissée ouverte, refus de presse-papiers, copie des deux valeurs exactes avec données de test, perte réseau puis retour, activité en erreur, dernière connexion vieillissante, rechargement après création. Aucun secret dans les captures partagées.

## S10 — Sources

**F — fichiers :** `web/app/[locale]/app/sources/page.tsx`, `web/components/app/sources/sources-manager.tsx`, `src/ferry_agent/api/sources.py`, messages `sources`.

- **Composition :** courte explication puis deux ensembles : « Sources en accès libre » et « Vos fichiers et sources locales ».
- **Gutenberg/Standard Ebooks :** état d’activation textuel + switch nommé ; attente par ligne ; confirmation ; valeur précédente conservée si erreur.
- **Import :** capacité disponible sans switch artificiel ; lien vers l’ajout de fichiers.
- **Sources Gateway :** expliquer la dépendance au module local ; lien vers Gateway ; ne pas déduire « connecté » d’un simple type de source. Si l’état du module n’est pas chargé, ne pas l’affirmer.
- **Recette :** lecture indisponible sans badge « active » trompeur, mutation échouée, réponses concurrentes sur deux sources, navigation retour cohérente, sources absentes du payload correctement distinguées d’une activation confirmée.
- **À exclure sans nouveau contrat :** formulaire d’indexer Prowlarr directement dans le cloud ; aucun tel formulaire n’est monté par `SourcesManager`.

## S11 — Réglages et catalogue liseuse

**F — fichiers :** `web/app/[locale]/app/reglages/page.tsx`, `web/components/app/settings/settings-form.tsx`, `reader-catalog-section.tsx`, `catalog-qr-code.tsx`, `src/ferry_agent/schemas.py`, `src/ferry_agent/api/opds.py`.

- **Composition :** préférences d’envoi ; catalogue sur liseuse ; renvois Sources/Appareils. Compte géré de façon cohérente avec le menu utilisateur.
- **Préférences :** email compte en lecture seule, email Kindle, format par défaut ; sauvegarde explicite, état modifié, valeur enregistrée comme référence. Effacer l’email envoie `null` conformément au comportement courant (`settings-form.tsx`).
- **Catalogue :** expliquer à quoi sert le lien ; liste nom, dernière utilisation, révocation ; créer un lien → URL réelle + copier + QR → avertissement d’affichage unique → fermer.
- **QR :** contraste franc, taille scannable, URL sélectionnable et aide textuelle ; erreur de génération distincte du chargement sans supprimer l’accès par lien.
- **Avertissement :** conséquence concrète de partager le lien, sans donner à toute la page une apparence d’incident.
- **Recette :** invalidité email, sauvegarde échouée, lecture partielle des trois ressources, presse-papiers indisponible, génération QR échouée, révocation, lien expiré/révoqué au lecteur si applicable au contrat ; noms longs en FR/EN.
- **Limite :** aucun indicateur chiffré de quota sans nouveau contrat ; `UserOut` ne fournit ni usage ni plafond (`src/ferry_agent/schemas.py`).

## S12 — Connexion, erreurs transversales et liseuses

**F :** la connexion est déclenchée par `SignInButton` et les surfaces de compte par `UserButton` (`web/components/marketing/site-header.tsx`, `hero.tsx`, `web/components/app/dashboard-header.tsx`) ; l’app est protégée (`web/app/[locale]/app/layout.tsx`). Aucune page Next de connexion personnalisée n’est inventoriée.

**R :** tester les surfaces Clerk réellement montées en FR/EN, retour à la destination prévue, chargement, erreur et navigation clavier. Toute personnalisation utilise les points d’extension du fournisseur, sans reconstruire l’authentification dans ce lot. Prévoir ensuite des surfaces Next de chargement/erreur/introuvable si leur ajout sert les parcours ; elles sont à créer.

**F :** `/c/{code}` est du HTML minimal sans JavaScript conçu pour de vieux navigateurs, rendu par `src/ferry_agent/services/tierc.py` et servi par `src/ferry_agent/api/tierc.py`. `/opds` est un protocole de catalogue (`src/ferry_agent/api/opds.py`).

**R :** étendre la cohérence produit à ces points de contact par les mots et la lisibilité : titre, auteur, bouton de téléchargement, message de code invalide/expiré, contraste monochrome, langue identifiée. Préserver leur simplicité et leurs URL ; ne pas leur imposer Next.js, Motion ou une interface lourde. La localisation du HTML backend doit être cadrée séparément, puisqu’elle ne passe pas actuellement par next-intl. La recette réelle sur liseuse est distincte d’une simulation desktop ; toute modification SQL déclenche un test Postgres réel selon `AGENTS.md`.
