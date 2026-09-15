# 08 — Feuille de route d’implémentation

## 1. Principe de livraison

**R :** une refonte globale livrée par tranches vérifiables. Le pilote est la bibliothèque, mais la correction du positionnement et la stabilisation de la coque précèdent sa déclinaison. Les numéros ci-dessous sont des lots proposés, **pas des tickets existants**. Ne pas les convertir en `TODO` sans une vraie référence conforme à `AGENTS.md`.

**F :** le dépôt impose CI verte, test de régression, Postgres réel pour le SQL, charte non-tech et symétrie i18n (`AGENTS.md`). Le workflow lu comporte des tests core/MCP/Gateway, Postgres, build web, ruff, fraîcheur des types, i18n et scan de secrets (`.github/workflows/ci.yml`). **V :** cette revue ne certifie pas leur état distant.

## 2. Lots et portes de sortie

| Lot | Périmètre concret | Dépendance | Critères de sortie et preuve |
|---|---|---|---|
| L0 — Référence et récit produit | Audit du checkout ; relever les erreurs existantes ; messages accueil/FAQ/meta et définition cloud/local | Aucun | Revue FR/EN de la promesse ; test comportemental démontrant que l’accueil distingue service en ligne et Gateway local ; captures avant/après si rendu disponible |
| L1 — Coque et fondations | Header public/mobile, sidebar, header app, focus, noms accessibles, tokens, contrôles et dialogs | L0 | Pas de débordement ; navigation complète à 320 px ; volet fermé après navigation ; séparateur stable ; labels traduits ; tests géométrie et clavier |
| L2 — Bibliothèque pilote | Collection prioritaire, espace d’ajout distinct, filtres/vues, états de données, import/recherche | L1 | Cas vide/rempli/partiel/erreur, import réellement confirmé, accès clavier aux livres ; pas de perte des capacités présentes |
| L3 — Livre et envoi | Détails, édition, suppression, choix appareil/méthode, confirmation et téléchargement | L2 | Formulaire nommé et utilisable ; mode fourni par l’API ; absence d’appareil récupérable ; pas de double envoi ; focus des fenêtres vérifié |
| L4 — Livraisons et appareils | Actualisation du suivi, statuts simples, cartes/tables ; création/édition appareil ; liaison fournisseur | L1, L3 | Liste/détail cohérents ; échec traduit ; test retour OAuth, popup bloquée et fermeture ; différence présentation simulée/intégration réelle documentée |
| L5 — Gateway et guide | États de connexion, codes, copie, activité ; explication cloud/local ; parcours d’installation | L0, L1 ; validation distribution pour les étapes d’installation | Deux secrets exacts ; aucune confusion vide/erreur ; expiration et hors-ligne ; preuve réelle par architecture/outil avant publication du guide |
| L6 — Sources, réglages et catalogue | Gestion principale des sources, préférences, liens catalogue et QR | L1, L4 ; renvois cohérents avec L5 | Sources non dupliquées ; échec de switch sans faux état ; copie vérifiée ; QR/lien utilisables et révocation comprise |
| L7 — Identité, assets et convergence | Accueil/guide finalisés, illustrations 2D, schéma, 3D optionnelle ; revue des points de contact liseuse | L2 à L6 | Assets réellement produits et documentés ; aucun lien cassé ; budget image respecté ; réduction du mouvement ; cohérence de tous les états |
| L8 — Recette complète | Parcours bout en bout et régressions croisées | Tous les lots concernés | Contrôles obligatoires verts, preuves réelles de rendu, résultats d’intégration requis, limites explicitement levées ou lot restant ouvert |

La vérification de la distribution Gateway peut commencer dès L0. Les améliorations de présentation indépendantes peuvent avancer pendant cette vérification ; les nouvelles étapes d’installation restent non validées tant que l’essai réel manque. Ne pas retarder les corrections de vérité produit pour attendre un visuel 3D facultatif.

## 3. Fichiers de départ par lot — F

| Lot | Points d’entrée existants |
|---|---|
| L0 | `web/messages/fr.json`, `web/messages/en.json`, `web/components/marketing/hero.tsx`, `value-props.tsx`, `faq.tsx`, `web/app/[locale]/layout.tsx` |
| L1 | `web/app/[locale]/app/layout.tsx`, `web/components/app/app-sidebar.tsx`, `dashboard-header.tsx`, `web/components/marketing/site-header.tsx`, `web/components/ui/sidebar.tsx`, `dialog.tsx`, `sheet.tsx`, `separator.tsx`, `web/app/globals.css` |
| L2/L3 | `web/app/[locale]/app/bibliotheque/page.tsx`, `web/components/app/library/`, `web/lib/use-gateway-job.ts`, `web/lib/types.ts` |
| L4 | `web/components/app/deliveries/`, `web/components/app/devices/`, `src/ferry_agent/services/delivery.py`, `src/ferry_agent/services/cloud_links.py` |
| L5 | `web/components/app/gateways/`, `web/components/docs/byo-install-guide.tsx`, `gateway/dist/`, `gateway/agent/ferry_gateway_agent/worker.py`, `.github/workflows/ci.yml` |
| L6 | `web/components/app/sources/sources-manager.tsx`, `web/components/app/settings/`, `src/ferry_agent/api/opds.py`, `src/ferry_agent/schemas.py` |
| L7/L8 | `web/components/marketing/`, `web/components/motion/reveal.tsx`, `web/components/status-dot.tsx`, `web/public/`, `src/ferry_agent/services/tierc.py`, `tests/`, `tests/integration/` |

Ces chemins indiquent où lire ; ils n’autorisent pas une modification globale de tous les fichiers. Toute surface créée doit être déclarée comme nouvelle dans le compte rendu.

## 4. Régressions concrètes à écrire — R

Choisir au moins un scénario comportemental par correctif, démontré rouge sur l’état antérieur et vert après. Les tests de simple présence d’un import ou d’appel d’une fonction sont insuffisants.

| ID proposé | Défaillance à reproduire | Assertion utile après correction | Niveau |
|---|---|---|---|
| T01 | Visiteur mobile sans navigation principale dans le header | Ouvre le menu, rejoint le guide au clavier et revient ; aucune largeur document supérieure au viewport | Navigateur |
| T02 | Séparateur/coque fragile en cas de modification des classes | Hauteur du séparateur dans la borne prévue ; largeur réservée cohérente après repli ; contenu non recouvert | Navigateur, géométrie |
| T03 | Carte de livre en mode liste mobile inaccessible au clavier | Tab puis Entrée ouvre le détail du livre nommé ; fermer restaure le focus | Navigateur |
| T04 | Historique en erreur affiché comme vide | Réponse en erreur → message indisponible et reprise ; réponse `[]` → vrai message vide | Composant ou navigateur avec API contrôlée |
| T05 | Page 2 des livres échoue et la collection paraît complète | Livres acquis conservés ; avertissement partiel ; nouvelle lecture permet de compléter | Intégration frontend avec réponses contrôlées |
| T06 | Copie annoncée réussie malgré refus du presse-papiers | Erreur visible ; lien/valeurs sélectionnables ; succès uniquement après résolution réelle | Navigateur |
| T07 | Statut d’envoi figé ou détail incohérent | Actualisation fait évoluer le statut dans liste/détail ; échec de lecture préserve la dernière valeur connue | Navigateur avec séquence de réponses |
| T08 | Compte fournisseur non relié présenté comme utilisable | Le mode indisponible est expliqué ; liaison réussie rend le mode accessible via réponse API | Intégration frontend ; OAuth réel séparé |
| T09 | Préférence de réduction ignorée par les animations CSS | Pas de ping/translation persistante, contenu visible et boutons utilisables | Navigateur, media query |
| T10 | Source absente/indisponible affichée comme activée | État inconnu explicite, action correcte après lecture réussie | Composant ou navigateur |
| T11 | Labels de champs et fermeture en anglais/incomplets | Nom accessible dans la langue courante, formulaire complet au lecteur d’écran | Automatisation sémantique + revue manuelle |

**F :** `web/package.json` n’a pas de script de tests frontend. **R :** dans une session d’implémentation autorisée, configurer le minimum nécessaire pour une suite navigateur/composant utile et l’intégrer à la validation. Décrire le choix dans un ADR s’il constitue une décision d’architecture. Ne pas déclarer des tests existants à partir de dépendances transitives du lockfile.

## 5. Vérifications par type de changement

| Changement | Contrôles attendus |
|---|---|
| Texte ou layout | Symétrie i18n, lint, build, test de régression adapté, captures des états affectés, lecture FR/EN |
| Composant partagé | Contrôles précédents + tous les usages critiques : header, sidebar, dialog, menu et formulaire |
| Chargement/mutation frontend | Réponses lentes, erreur, vide, partiel, doubles actions, navigation pendant opération |
| Contrat API | Tests backend ciblés, types régénérés, fraîcheur OpenAPI/TS, erreur traduite côté UI |
| SQL | Test d’intégration avec Postgres réel et `TEST_DATABASE_URL` ; ne pas substituer des fakes |
| Flux Gateway | Tests agent/core applicables, connexion et fichier réel de test selon le lot, archive par architecture réellement validée |
| Catalogue/liseuse | Régression backend pertinente, compatibilité HTML sans JS, ouverture réelle dans un lecteur compatible |
| Nouvel asset | Existence, dimensions, poids, provenance, alternative, recadrage, absence de décalage de mise en page |

Références existantes pour cibler les tests : `tests/test_books_crud.py`, `tests/test_upload_validation.py`, `tests/test_library_quota.py`, `tests/test_delivery_methods.py`, `tests/test_devices_link.py`, `tests/test_cloud_links.py`, `tests/test_gateways.py`, `tests/test_opds_catalog.py`, `tests/integration/test_delivery_out_enrichment.py`, `tests/integration/test_device_cloud_link.py`, `tests/integration/test_gateway_recreate.py`, `tests/integration/test_opds.py`, `gateway/agent/tests/`. Leur présence ne signifie pas qu’ils couvrent déjà la nouvelle UX ; lire les assertions avant réemploi.

## 6. Matrice de recette visuelle et fonctionnelle

**R :** couvrir au minimum les catégories suivantes ; élargir lorsqu’un changement le justifie.

| Axe | Valeurs |
|---|---|
| Écrans | Accueil, guide, bibliothèque, détail/envoi, appareils/liaison, livraisons/détail, Gateway/codes, sources, réglages/catalogue |
| Largeur | 320, 390, 768, 1024, 1440 px ; vérification spécifique 767/768 |
| Langue | Français et anglais ; libellés les plus longs |
| Données | Vide, cas courant, quantité importante, titre/nom/description longs, image absente |
| Réseau | Succès, lent, refus, panne, interruption pendant action, retour à une ancienne valeur |
| Entrée | Clavier seul, toucher, souris ; focus modale et retour navigation |
| Préférences | Réduction des animations ; zoom 200 % ; reflow à 400 % |
| Intégrations | Clerk, livraison, fournisseur cloud, Gateway, QR/catalogue et liseuse selon le périmètre réellement testé |

Le passage des vérifications web ne certifie pas la réception sur liseuse. Une donnée simulée doit être marquée « fixture » dans la preuve. Une capture du rendu de production et une capture locale doivent être distinguées.

## 7. Format de preuve par lot

Créer un compte rendu de recette avec : commit testé ou état exact du diff, version de l’environnement, fichiers, préconditions, source des données, viewport/langue, test rouge avant, test vert après, commandes et codes de sortie, captures avant/après, erreurs console/réseau analysées, limites restantes.

Ne jamais enregistrer de vrais codes Gateway, URL privées de catalogue, tokens Clerk ni données personnelles dans ces preuves. Utiliser des comptes et fichiers de test ; documenter uniquement la structure des valeurs nécessaires.

La CI verte est celle du changement effectivement testé, pas celle d’un ancien HEAD. Lorsque la session ne permet pas de publier ou de consulter la CI, indiquer que la condition distante reste à vérifier ; le lot n’est pas déclaré totalement terminé au sens d’`AGENTS.md`.

## 8. Arbitrages encore ouverts

| Sujet | Orientation proposée | Ce qui manque / quand décider |
|---|---|---|
| Nom Accès/Gateway | Gateway + explication simple | Validation éditoriale lors de L0 ; ne bloque pas la correction du modèle cloud |
| Prompt externe | Confronter sa teneur au dossier | Document non trouvé ; toute instruction incompatible avec le cloud doit être corrigée |
| Thème clair | Lot séparé éventuel | Besoin utilisateur et recette complète ; ne bloque pas l’unification sombre |
| Pagination/reprise des tâches | État partiel fiable d’abord, évolution de chargement ensuite | Volumes réels et contrat de reprise ; décider avant extension API |
| Quota chiffré | Pas de jauge tant que le contrat manque | Endpoint fiable de consommation/plafond et tests éventuels |
| Statuts métier | Traduire selon le résultat observé de chaque canal | Validation produit du vocabulaire, surtout « livré » |
| Distribution Gateway | GUI + archive docker-format par architecture | Vérification effective des artefacts servis et essai machine selon ADR 0005 |
| Garanties cloud | Description limitée aux faits établis | Politique opérationnelle de stockage, sauvegarde, rétention ; aucune promesse inventée |
| Illustration 3D | Facultative, statique | Bénéfice visuel, budget et asset réellement produit après les parcours |

Ces arbitrages sont documentés ici comme recommandations en attente. Aucun ADR nouveau n’est créé pendant la revue et aucun numéro de ticket fictif n’est utilisé.
