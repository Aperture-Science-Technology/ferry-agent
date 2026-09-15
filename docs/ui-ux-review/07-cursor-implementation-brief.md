# 07 — Brief d’implémentation pour Cursor

## Mode d’emploi

Copier le prompt ci-dessous dans une **session explicitement autorisée à implémenter** et joindre ce dossier. La présente revue reste documentaire : ce texte n’autorise pas rétroactivement une modification du code pendant la mission d’audit.

Le prompt source autonome n’a pas été trouvé ; ce brief transpose la demande de la conversation en étapes exécutables, en tenant compte des preuves de [01](01-current-state-audit.md). Tous les choix cibles sont des recommandations à confronter au checkout réellement ouvert.

---

## Prompt à transmettre

Tu es l’agent Cursor chargé de la refonte globale produit, UX et design de Ferry Agent. Ton objectif est une webapp simple, épurée, harmonieuse, calme, fiable et premium, cohérente sur l’accueil, le guide, les écrans connectés, les composants, les états et les petits écrans.

### 1. Invariants produit et périmètre

**Ferry Agent est une webapp cloud.** Bibliothèque, appareils, livraisons, sources et réglages se gèrent dans la webapp. **Seul le Gateway est local/self-hosted** : il gère notamment les téléchargements torrent et la communication avec Prowlarr, puis communique avec la plateforme. Ne présente jamais tout le service comme auto-hébergé ni la bibliothèque comme exclusivement locale. Ne promets pas absence de stockage côté service, lecture confirmée, sauvegarde ou confidentialité sans preuve du contrat réel.

La refonte couvre architecture de l’information, direction artistique, système de composants, responsive, accessibilité, états, micro-interactions, animations discrètes, illustrations 2D/3D et schémas. Ce périmètre ne justifie pas une réécriture des protocoles d’authentification, de livraison ou de Gateway. Conserve les capacités existantes et les protections serveur.

Lis `AGENTS.md`, `web/AGENTS.md`, les ADR applicables et tous les documents sous `docs/ui-ux-review/`. Respecte l’autorisation de la session. Si elle reste limitée à la documentation, n’édite aucun fichier hors `docs/ui-ux-review/`. Ne change pas de branche et ne crée pas de commit sans instruction l’autorisant. Ne lance aucune livraison, révocation ou installation sur un compte réel pour tester une maquette.

### 2. Audit obligatoire avant toute édition

1. Relever branche, HEAD, état Git et modifications préexistantes ; préserver le travail présent.
2. Lire les fichiers réels du lot, leurs parents et usages. Confirmer la présence des composants et assets cités. Examiner les commits récents concernant la zone.
3. Vérifier les versions dans `web/package.json` et `web/package-lock.json`, les signatures des primitives locales et les guides Next de `web/node_modules/next/dist/docs/` si disponibles.
4. Relever les requêtes, payloads, champs optionnels, statuts et erreurs. Distinguer ce que le backend sait de ce que l’interface propose.
5. Définir un scénario actuel reproductible, le comportement attendu et une preuve de régression. Si possible, lancer le rendu existant et capturer la même route en desktop/mobile et FR/EN avec des données de test. Consigner ce qui est réellement observable ; si une session authentifiée manque, avancer sur les parties testables et noter précisément la limite.
6. Présenter un plan de tranche concret : fichiers, comportement, composants réemployés/créés, risques et recette. Pas de modification massive avant cette inspection.

Référence historique de la revue : HEAD `a42a80e` sur `main`. À cet état, les clés i18n passaient (519), le lint web échouait (11 erreurs, 1 avertissement). Ces résultats doivent être recontrôlés dans ton checkout ; ils ne prouvent pas l’état actuel de la CI.

### 3. Direction produit et visuelle

- Bibliothèque comme destination principale ; collection remplie avant les grandes zones d’import/recherche. Distinguer « retrouver dans mes livres » de « chercher dans les sources ».
- Navigation proposée : Bibliothèque, Livraisons, Appareils, Sources, Gateway, Réglages. Conserver les URL localisées actuelles ; ne pas renommer les slugs pour une préférence esthétique.
- Sources a un lieu de gestion principal ; Réglages y renvoie. Le Gateway est complémentaire et expliqué avec « module installé chez vous ».
- Conserver les fondations Geist/Fraunces, l’encre sombre et l’accent sarcelle avec les tokens et règles de `03-art-direction.md`. Pas de statistiques inventées, de grille de cartes omniprésente ni de dégradé sur chaque section.
- Réemployer les primitives shadcn locales fondées sur **Base UI**, avec leur composition `render`. Ne pas coller des exemples Radix supposant `asChild`.
- Utiliser Tailwind et les variables sémantiques existantes. Motion sert des transitions brèves et Lucide les icônes fonctionnelles. Toutes les animations, y compris CSS, suivent la réduction des mouvements.
- Produire les illustrations seulement après les fondations : 2D fonctionnelle, schéma cloud/local à texte traduisible, 3D statique facultative. Documenter provenance, tailles et alternatives ; ne pas importer de moteur 3D pour un visuel statique. Aucun asset absent ne doit être référencé avant sa création.

### 4. Contraintes techniques à préserver

- Next App Router, paramètres asynchrones des routes et séparation serveur/client. Préserver `auth.protect()` dans `web/app/[locale]/app/layout.tsx`, le contexte Clerk et le routage de `web/proxy.ts`.
- Conserver le flux des appels serveur `web/lib/api.ts` et navigateur `web/lib/api-client.ts`. Pas de données d’un autre utilisateur dans un cache commun. Pas d’édition manuelle des types générés pour faire disparaître une erreur TypeScript.
- Utiliser les helpers `web/i18n/navigation.ts`. Traduire tous les textes visibles et accessibles en FR/EN avec clés strictement symétriques ; suivre `docs/adr/0007-charte-documentation-non-technique.md`. Formater les dates avec la locale de l’app, pas celle du navigateur par hasard.
- Réserver les détails internes à la documentation opérateur. Ne pas afficher `job.method`, JSON d’erreur ou tiers A/B/C bruts aux lecteurs.
- **Header/sidebar :** lire ensemble layout, `AppSidebar`, `DashboardHeader`, `SidebarProvider`, `SidebarInset`, `useIsMobile`, `Sheet` et `Separator`. Vérifier les commits `ee8e473` et `d870847` : le séparateur vertical a un parent contraint `h-4` pour une raison. Garder une réservation de largeur unique, tester repli, 767/768 px, focus, langues, état au rechargement et overlays. Ne pas remplacer toute la coque en une seule étape.
- Préserver le proxy authentifié et le nettoyage des URL de couverture dans `web/components/app/library/cover-image.tsx`.
- Préserver OAuth appareils : popup, `window.opener`, messages de même origine, retour `cloud_link` et polling. Ne pas ajouter `noopener` à ce flux sans refondre et tester le protocole.
- Distinguer fin du transfert d’import, ajout confirmé à la bibliothèque et envoi à l’appareil. Une animation ne simule pas une progression inconnue.
- Codes Gateway et liens catalogue sont sensibles et peuvent être affichés une seule fois. Vraie copie vérifiée, alternative sélectionnable, aucune valeur réelle dans captures ou logs.
- Le guide Gateway dépend d’une validation réelle des archives docker-format par architecture et du parcours OrbStack/Docker Desktop. Ne pas fabriquer d’URL, de commande à trous ou d’étape GUI non vérifiée. Appliquer ADR 0005.
- Le HTML `/c/{code}` et le catalogue `/opds` sont servis côté backend ; préserver compatibilité liseuse et simplicité. Ne pas leur imposer la pile visuelle Next/Motion.

### 5. États et accessibilité obligatoires

Pour chaque écran modifié, traiter : chargement, contenu, vide réel, aucun résultat, erreur, données partielles, attente de mutation, succès, résultat incertain, état désactivé et action destructive pertinente. Une panne ne devient pas une liste vide. Un toast n’est pas le seul moyen de retrouver un téléchargement ou une erreur persistante.

Appliquer : HTML sémantique, contrôles nommés, labels associés, focus visible, liens d’évitement, navigation courante annoncée, gestion du focus des dialogs, fermeture du volet après navigation, aucune action réservée au hover, alternative au drag-and-drop. Viser WCAG 2.2 AA avec contrôles tactiles confortables et les règles de `04-interaction-motion.md`.

Recette minimale : 320, 390, 768, 1024 et 1440 CSS px ; seuil 767/768 ; FR/EN ; titre long ; collection vide/remplie ; réseau en échec ; navigation clavier ; zoom 200 % et reflow à 400 % ; réduction des animations. Ajouter une recette réelle sur liseuse pour les modifications qui la concernent.

### 6. Implémentation incrémentale

Suivre `08-implementation-roadmap.md` : récit produit et référence de test → coque et primitives sensibles → bibliothèque comme écran pilote → détails/envoi → livraisons/appareils → Gateway/guide validé → sources/réglages/catalogue → assets et recette transversale.

Chaque tranche doit rester compréhensible et testable : un objectif comportemental, un ensemble limité de fichiers, une preuve avant/après, un diff relu. Extraire des composants uniquement si cela clarifie une responsabilité réellement partagée. Ne pas cacher les erreurs lint ou retirer les tests pour obtenir du vert. Toute décision d’architecture adoptée demande un ADR selon les consignes du dépôt.

Ne pas ajouter dans cette refonte des fonctionnalités non contractées : quotas chiffrés sans API, recherche de collection simplement renommée, retry d’envoi non sûr, synchronisation automatique universelle, gestion cloud complète des indexers ou actions de restauration inexistantes. Cadrer ces besoins séparément si nécessaires.

### 7. Vérifications et définition de terminé

Exécuter les contrôles adaptés au diff et les exigences du dépôt :

- `cd web && npm run check:i18n`
- `cd web && npm run lint`
- `cd web && npm run build`
- tests comportementaux du lot avec le runner réellement installé/configuré ; ne pas inventer `npm test` si ce script n’existe pas ; ajouter le minimum de test nécessaire dans une session d’implémentation autorisée ;
- **au moins un test de régression pertinent par correctif**, montrant un comportement défaillant avant et réussi après, pas seulement un appel de fonction ;
- si SQL touché : test d’intégration **Postgres réel** dans `tests/integration/` avec `TEST_DATABASE_URL` ;
- si contrat API modifié : régénération des types avec les scripts existants, vérification de fraîcheur et tests backend concernés ;
- exigences de la CI du checkout, statut réel associé au commit pertinent si la session autorise sa publication. Sans accès ou exécution distante, dire « vérifié localement » et ne pas affirmer « CI verte ».

Capturer les pages réellement exécutées après modification avec viewport, langue, scénario et source des données. Une fixture documentée teste la présentation, pas l’intégration du service. Masquer les données privées et secrets. Contrôler les liens, actions, console, erreurs réseau attendues et réduction des animations. Comparer les mêmes scénarios avant/après.

Si une dépendance empêche une validation complète, terminer les parties indépendantes, rapporter le contrôle manquant et maintenir le lot comme non validé ; ne pas substituer une image plausible à une preuve d’exécution.

### 8. Compte rendu attendu à chaque tranche

1. Problème concret et comportement obtenu.
2. Fichiers modifiés, composants réemployés et créations réelles.
3. Test de régression : scénario, résultat avant, résultat après.
4. Commandes réellement exécutées et résultat ; captures avec contexte.
5. Risques ou validations encore manquantes, puis prochain lot.

Ton travail est jugé sur la justesse du produit, la continuité des parcours et les preuves, autant que sur la qualité des captures.

---

## Contrôle éditorial du brief

Ce prompt évite trois écueils identifiés dans le dépôt : reprendre le récit entièrement local des messages actuels (`web/messages/fr.json`, `en.json`), importer un template ignorant les contraintes de coque (`web/components/ui/sidebar.tsx`, `web/components/app/dashboard-header.tsx`), ou supposer des ressources et tests non configurés (`web/public/`, `web/package.json`). Il ne prétend ni qu’une implémentation a été réalisée, ni qu’un rendu a été validé pendant cette revue.
