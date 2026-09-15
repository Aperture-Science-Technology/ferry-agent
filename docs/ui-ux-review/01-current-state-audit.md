# 01 — Audit de l’état réel

## 1. Méthode et traçabilité

**V — 15 septembre 2026 :** `git status --short` initial vide ; branche `main` ; HEAD `a42a80e76f96edb21deb218bff80c110f4e968c1`. Lecture avec `rg`, `cat`, `sed`, `git log` et `git show`. Inspection du code web, des messages FR/EN, de `web/public/`, des contrats et flux backend utiles à la compréhension des écrans. Les chemins cités désignent le checkout, pas une preuve de mise en production.

**V :** aucun serveur démarré, aucun navigateur utilisé, aucune capture générée. Aucun test fonctionnel réel de connexion, d’import, de livraison, de Gateway, de QR ou de liseuse. Les constats de débordement, contraste ou ressenti sont donc formulés comme risques, jamais comme observations visuelles.

### Contrôles exécutés

| Contrôle | Résultat | Portée |
|---|---|---|
| `node web/scripts/check-i18n-keys.mjs` | Passe, 519 clés FR/EN | Égalité des chemins de clés ; ne contrôle ni véracité, ni traductions, ni tous les messages JSX |
| `cd web && npm run lint` | Échec, 11 erreurs et 1 avertissement | ESLint sans correction ; état antérieur à toute implémentation |
| Inspection de `.github/workflows/ci.yml` | Tests Python/core/MCP, Gateway, Postgres, build web, ruff, types, i18n, secrets ; audit dépendances non bloquant | Workflow lu ; exécution distante non vérifiée |
| Inventaire des routes/assets/dépendances | Réalisé | Fichiers présents ; pas de preuve de disponibilité réseau |
| Build, tests backend/intégration, Lighthouse, tests navigateur | Non exécutés | Mission documentaire ; aucune CI verte annoncée |

Le détail du lint est conservé ci-dessous comme référence avant correction. Une seconde lecture via l’API ESLint, sans écriture, a extrait les positions et règles pour éviter la troncature du premier affichage. Configuration : `web/eslint.config.mjs`. Le décompte est une mesure locale, pas le statut d’une CI.

| Fichier | Ligne(s) au HEAD audité | Résultat |
|---|---|---|
| `web/components/app/deliveries/delivery-detail-dialog.tsx` | 48 | 1 erreur `react-hooks/set-state-in-effect` |
| `web/components/app/devices/cloud-link-dialog.tsx` | 58, 59 | 2 erreurs `react-hooks/refs` |
| `web/components/app/devices/devices-view.tsx` | 182 | 1 erreur `react-hooks/set-state-in-effect` |
| `web/components/app/devices/edit-device-dialog.tsx` | 54 | 1 erreur `react-hooks/set-state-in-effect` |
| `web/components/app/gateways/gateways-view.tsx` | 117 | 1 erreur `react-hooks/set-state-in-effect` |
| `web/components/app/library/cover-image.tsx` | 31 | 1 erreur `react-hooks/set-state-in-effect` |
| `web/components/app/library/library-view.tsx` | 241 | 1 avertissement `@typescript-eslint/no-unused-vars` |
| `web/components/app/settings/reader-catalog-section.tsx` | 68 | 1 erreur `react-hooks/set-state-in-effect` |
| `web/components/app/settings/settings-form.tsx` | 80 | 1 erreur `react-hooks/set-state-in-effect` |
| `web/components/app/sources/sources-manager.tsx` | 41 | 1 erreur `react-hooks/set-state-in-effect` |
| `web/lib/use-gateway-job.ts` | 25 | 1 erreur `react-hooks/set-state-in-effect` |

## 2. Stack et contraintes réelles — F

| Sujet | Présence constatée | Référence |
|---|---|---|
| Framework | Next.js déclaré `16.3.4`, React `19.2.8`, App Router, TypeScript | `web/package.json`, `web/app/`, `web/tsconfig.json` |
| UI | shadcn `base-nova`, primitives **Base UI**, composition `render`, Tailwind v4 | `web/components.json`, `web/components/ui/button.tsx`, `web/components/ui/dialog.tsx`, `web/app/globals.css` |
| Mouvement/icônes | `motion` déclaré `^13.2.0`, `lucide-react` `^1.40.0` | `web/package.json`, `web/components/motion/reveal.tsx` |
| Langues | FR/EN, français par défaut, préfixe de locale toujours présent ; slugs français aussi en anglais | `web/i18n/routing.ts`, `web/i18n/navigation.ts`, `web/app/[locale]/app/` |
| Authentification | `ClerkProvider` dans le layout de langue ; `auth.protect()` dans le layout app ; proxy Clerk + next-intl | `web/app/[locale]/layout.tsx`, `web/app/[locale]/app/layout.tsx`, `web/proxy.ts` |
| Lecture serveur | API avec token et `cache: no-store` ; `safeApiFetch` convertit toute exception en `null` | `web/lib/api.ts` |
| Mutations navigateur | `/api/v1` même origine, bearer Clerk, réécriture vers backend | `web/lib/api-client.ts`, `web/next.config.ts` |
| Contrats | Types dérivés OpenAPI, alias UI séparés | `openapi.json`, `web/lib/api-types.generated.ts`, `web/lib/types.ts`, `scripts/gen-api-types.sh` |
| Polices et thème | Geist, Geist Mono, Fraunces ; classe `dark` imposée sur HTML ; pas de sélecteur de thème dans les headers lus | `web/app/[locale]/layout.tsx`, `web/components/app/dashboard-header.tsx`, `web/components/marketing/site-header.tsx` |
| Toasts | Sonner lit `next-themes`, valeur de repli `system` ; layout impose `dark` et ne monte pas de ThemeProvider | `web/components/ui/sonner.tsx`, `web/app/[locale]/layout.tsx` |
| Tests web | Pas de script test/E2E dans le manifeste ; pas de configuration de test navigateur trouvée dans les fichiers du projet examinés | `web/package.json`, `.github/workflows/ci.yml` |

**I :** vérifier l’accord du thème Sonner avec la page sombre. La présence de dépendances transitives `axe-core` et d’une référence peer à Playwright dans `web/package-lock.json` ne constitue pas une suite de tests configurée.

**R :** ne pas appliquer une recette Radix avec `asChild` à ces composants Base UI sans lire leurs signatures. Lire les guides locaux de la version Next installée avant édition, comme le demande `web/AGENTS.md`. Le layout racine se contente actuellement de retourner `children`, tandis que HTML/body vivent dans le layout de langue : ne pas déplacer cette frontière pendant une retouche esthétique (`web/app/layout.tsx`, `web/app/[locale]/layout.tsx`).

## 3. Cartographie des écrans — F

Toutes les routes Next ci-dessous sont précédées de `/fr` ou `/en`.

| URL | Fonction réellement câblée | Chemins |
|---|---|---|
| `/` | Accueil : hero, étapes, destinations, avantages, assistant IA, FAQ, footer | `web/app/[locale]/page.tsx`, `web/components/marketing/` |
| `/docs` | Guide surtout consacré au Gateway ; 5 étapes, glossaire, dépannage, bloc MCP | `web/app/[locale]/docs/page.tsx`, `web/components/docs/byo-install-guide.tsx` |
| `/app` | Redirection bibliothèque | `web/app/[locale]/app/page.tsx` |
| `/app/bibliotheque` | Import fichiers, recherche sources, ajout asynchrone, bibliothèque grille/liste, filtres, détails/édition/envoi/suppression | `web/app/[locale]/app/bibliotheque/page.tsx`, `web/components/app/library/` |
| `/app/appareils` | Création, édition, suppression ; liaison Dropbox/Drive et traitement du retour `cloud_link` | `web/app/[locale]/app/appareils/page.tsx`, `web/components/app/devices/` |
| `/app/livraisons` | Liste, détail, accès à une URL de téléchargement si fournie | `web/app/[locale]/app/livraisons/page.tsx`, `web/components/app/deliveries/` |
| `/app/gateways` | Création des deux secrets, attente, état connecté/hors ligne, recréation, révocation, suppression, activité récente | `web/app/[locale]/app/gateways/page.tsx`, `web/components/app/gateways/` |
| `/app/sources` | Activation Gutenberg/Standard Ebooks ; affichage import et torrent | `web/app/[locale]/app/sources/page.tsx`, `web/components/app/sources/sources-manager.tsx` |
| `/app/reglages` | Email compte en lecture seule, email Kindle, format, sources, liens catalogue liseuse/QR, renvoi appareils | `web/app/[locale]/app/reglages/page.tsx`, `web/components/app/settings/` |
| `/c/{code}` hors Next | Page de téléchargement HTML minimal sans JS ; code expiré et téléchargement | `src/ferry_agent/api/tierc.py`, `src/ferry_agent/services/tierc.py`, `deploy/docker-compose.yml` |
| `/opds` hors Next | Catalogue pour lecteurs compatibles, contrôlé par des liens d’accès créés dans les réglages | `src/ferry_agent/api/opds.py`, `web/components/app/settings/reader-catalog-section.tsx`, `deploy/docker-compose.yml` |

**F :** aucun fichier `loading.tsx`, `error.tsx` ou `not-found.tsx` personnalisé n’est présent dans l’arborescence `web/app/` inventoriée. Pas de page Next dédiée à un livre ni de page de connexion personnalisée dans cette arborescence ; détails par dialog et accès via composants Clerk. **R :** ne pas décrire ces routes ou composants comme existants.

## 4. Contradictions produit — F / I / R

| Clés FR et EN dans `web/messages/fr.json`, `web/messages/en.json` | Fait | Inférence et suite |
|---|---|---|
| `meta.description`, `hero.badge` | Le texte associe le produit à une exécution « chez vous » | **I :** l’ambiguïté commence avant la connexion. **R :** annoncer l’espace en ligne |
| `valueProps.items.selfHosted.*` | Promesse de livres sur la machine et absence de stockage chez l’éditeur | **I :** contradiction directe avec le cadrage. **R :** remplacer la promesse, pas seulement le mot self-hosted |
| `valueProps.items.detached.body` | Le programme Accès ne passerait jamais par les serveurs | **F :** `worker.py` appelle la plateforme et y envoie les fichiers. **R :** expliquer cette connexion |
| `howItWorks.steps.prepare.body` | Le livre resterait chez l’utilisateur | **R :** « Le livre rejoint votre bibliothèque en ligne » |
| `faq.items.selfHosted.a`, `faq.items.myData.a` | Bibliothèque, appareils et historique présentés comme locaux | **R :** distinguer service en ligne, module local et politique des données à confirmer |
| `docs.intro`, `docs.metaDescription`, `docs.byoDescription` | Guide formulé autour d’un « accès personnel » | **I :** peut faire croire à l’installation de tout le service. **R :** nommer explicitement le Gateway et son caractère complémentaire |

Preuves de flux : `gateway/agent/ferry_gateway_agent/worker.py` (`poll_once`, `_handle_fetch`), `src/ferry_agent/api/gateways.py` (`fetch-result`), `src/ferry_agent/services/library.py` (stockage), `deploy/docker-compose.yml` (services core/web et bibliothèque). Le déploiement déclaré n’atteste pas les garanties opérationnelles du service en production.

## 5. Coque, header et sidebar : zone sensible

### Faits

- `web/app/[locale]/app/layout.tsx` compose `SidebarProvider`, `AppSidebar`, `SidebarInset`, `DashboardHeader`, puis un `main` avec `p-6`.
- `web/components/ui/sidebar.tsx` réserve un espace desktop distinct du panneau fixé ; largeurs déclarées 16 rem desktop, 18 rem mobile, 3 rem pour la variante icône. `AppSidebar` utilise les valeurs par défaut : **repli offcanvas**, pas une barre d’icônes active.
- Seuil mobile 768 px dans `web/hooks/use-mobile.ts` ; la sidebar emploie aussi `md`. État initial du hook dépendant de `window`, structure mobile rendue en `Sheet`.
- Le provider écrit le cookie `sidebar_state`, mais le layout app ne le lit pas pour fournir `defaultOpen` (`web/components/ui/sidebar.tsx`, `web/app/[locale]/app/layout.tsx`).
- `AppSidebar` marque visuellement l’élément actif avec `startsWith`, sans `aria-current` explicite ; aucun gestionnaire de fermeture du panneau après navigation n’y est câblé (`web/components/app/app-sidebar.tsx`).
- `DashboardHeader` fait 56 px (`h-14`), n’est pas sticky dans ce fichier, contient un séparateur dans un parent `h-4`, les langues et `UserButton` (`web/components/app/dashboard-header.tsx`).
- Le séparateur Base UI utilise `data-vertical:self-stretch` (`web/components/ui/separator.tsx`). Historique : `ee8e473` tente une hauteur sur le séparateur, `d870847` introduit son parent contraint ; `git show` sur ces deux commits le confirme.
- Header public sticky 64 px, `z-50`, liens cachés sous `md`, deux actions pour le visiteur non connecté, langues, aucune navigation mobile de remplacement (`web/components/marketing/site-header.tsx`).
- Libellés anglais codés en dur dans les primitives : « Toggle Sidebar », « Sidebar », « Displays the mobile sidebar. », « Close » (`web/components/ui/sidebar.tsx`, `dialog.tsx`, `sheet.tsx`).

### Inférences à reproduire

**I :** débordement possible du header public étroit ; volet mobile pouvant rester ouvert après changement de page ; divergence serveur/client possible autour du hook mobile ; absence de restauration effective du repli au rechargement ; focus et empilement fragiles si le header devient sticky sans revoir les portails. Aucune de ces conséquences n’a été observée dans un navigateur durant cette revue.

### Recommandations

**R :** une seule responsabilité pour la navigation globale, une seule largeur réservée, un seul titre de page principal. Tester 320/390/768/1024/1440 px, seuil 767↔768, navigation clavier, FR/EN, retour arrière, modale au-dessus du volet, repli puis rechargement. Conserver le parent du séparateur ou démontrer par un test de géométrie qu’une alternative tient. Ne pas remplacer toute la primitive sidebar par un template.

## 6. Frictions des parcours

| Faits et références | Problème inféré | Recommandation |
|---|---|---|
| Import puis recherche précèdent les livres dans `web/components/app/library/library-view.tsx` | La collection devient secondaire, surtout sur petit écran | Bibliothèque en premier quand elle est remplie ; ajout/recherche dans un panneau explicite |
| La recherche POST demande `scope: ["legal", "gateways"]`, les filtres de collection ne filtrent pas par `query` (`library-view.tsx`) | Confusion entre chercher un livre possédé et chercher dans les sources | Deux intentions nommées ; une recherche locale de collection serait un ajout à implémenter |
| Toutes les pages de 200 livres sont chargées côté serveur ; si une page suivante échoue, boucle interrompue sans indicateur (`web/app/[locale]/app/bibliotheque/page.tsx`) | Lenteur potentielle et collection partielle présentée comme complète | État partiel explicite ; évolution de pagination dans un lot séparé |
| Tâches d’ajout en mémoire React, polling 3 s jusqu’à 20 min (`library-view.tsx`, `web/lib/use-gateway-job.ts`) | Suivi perdu après navigation/rechargement ; délai UI confondu avec échec réel | Expliquer le délai d’observation, conserver une voie de suivi Gateway ; persistance à cadrer |
| XHR d’import avec vraie progression, formats EPUB/PDF/MOBI/AZW3, limite client 200 × 1024² octets (`upload-dropzone.tsx`) | 100 % transféré peut précéder la validation serveur | Phase « Ajout à la bibliothèque… » distincte après transfert |
| Mode liste mobile : `Card onClick` sans bouton Détails (`library-view.tsx`) | Accès aux détails non disponible par tabulation dans cette variante | Action native atteignable et nommée |
| `Label` sans `htmlFor`/ID dans création appareil, méthode/format d’envoi (`devices/new-device-dialog.tsx`, `library/deliver-dialog.tsx`) | Champ mal annoncé | Association explicite des labels, aides et erreurs |
| Méthodes d’envoi issues de `/devices/{id}/methods` (`library/deliver-dialog.tsx`, `src/ferry_agent/services/delivery_methods.py`) | Une refonte basée seulement sur la marque promettrait des modes indisponibles | Préserver le contrat de disponibilité |
| `job.method`, erreurs et parfois `job.status` bruts rendus (`library/book-detail-dialog.tsx`, `library/deliver-dialog.tsx`, `deliveries/delivery-detail-dialog.tsx`) | Jargon, erreurs JSON ou mauvais anglais malgré l’i18n symétrique | Traduire les codes ; message simple et action utile |
| OAuth utilise `window.opener`, `postMessage` de même origine, retour `cloud_link` et polling (`devices/cloud-link-dialog.tsx`, `devices/devices-view.tsx`) | Refactor de modale ou ajout aveugle de `noopener` peut casser la liaison | Préserver le protocole et tester popup bloquée, fermeture, refus, succès |
| `SourcesManager` affiche « Toujours active » pour torrent, sans information Gateway (`sources/sources-manager.tsx`, messages `sources.alwaysActive`) | Source configurée assimilée à source disponible | Séparer activation, disponibilité et besoin du Gateway |
| Dialog global centré sans max-height/scroll systématique (`web/components/ui/dialog.tsx`) ; contenu livre et QR long (`library/book-detail-dialog.tsx`, `settings/reader-catalog-section.tsx`) | Actions hors écran sur mobile ou zoom | Hauteur bornée au viewport, zone scrollable, footer atteignable |
| Copie OPDS annonce le succès sans attendre le presse-papiers (`settings/reader-catalog-section.tsx`) | Faux succès ; URL à usage sensible perdue à fermeture | Attendre la copie, gérer l’échec, conserver l’URL sélectionnable |
| Quota vérifié au backend mais `UserOut` n’expose pas de consommation/plafond (`src/ferry_agent/services/library.py`, `src/ferry_agent/schemas.py`) | Une jauge inventée afficherait une fausse précision | Traiter le refus 507 ; ne pas dessiner de jauge liée à une API inexistante |

## 7. Visuel, assets, mouvement — faits et limites

**F :** `web/app/globals.css` définit un thème sombre bleu-vert, plusieurs tokens `chart-*` employés comme accents ; `PageHeader`, `SectionHeader`, `StatePanel` et plusieurs dialogs répètent un filet dégradé (`web/components/app/page-header.tsx`, `section-header.tsx`, `state-panel.tsx`, `library/book-detail-dialog.tsx`). **I :** répétition susceptible d’alourdir la hiérarchie. **R :** un accent de marque par composition, des séparateurs neutres ailleurs.

**F :** `Reveal` applique une translation de 16 px et 500 ms, avec adaptation à `useReducedMotion` ; `StatusDot` conserve un `animate-ping` sans variante de réduction dans son code. Les classes CSS des sheets/dialogs et certains hovers ne suivent pas ce hook (`web/components/motion/reveal.tsx`, `web/components/status-dot.tsx`, `web/components/ui/sheet.tsx`, `web/components/ui/dialog.tsx`, `web/components/marketing/delivered.tsx`). **R :** couvrir également les animations CSS et les changements de disposition.

**F :** huit SVG seulement dans `web/public/`, dont cinq génériques et trois de marques ; `web/app/favicon.ico` est séparé. Logos Kindle/Kobo également intégrés en TSX ; couvertures provenant de données, non d’un pack local (`web/components/app/devices/brand-logos.tsx`, `web/components/app/library/cover-image.tsx`). L’inventaire [06](06-component-and-asset-inventory.md) distingue les fichiers existants des créations proposées.

## 8. Analyse du prompt de refonte disponible

**V :** recherches de noms et de contenu autour de `prompt`, `cursor`, `refonte`, `ui/ux`, `ui-ux`, `design` dans les fichiers du dépôt examinés : pas de prompt autonome identifié. Les dépendances, `.git`, environnements virtuels et caches ne constituent pas un corpus produit. La consigne de cette conversation reste la référence disponible.

**Points solides du brief reçu :** positionnement cloud explicite ; périmètre transversal ; demande de preuves ; contrainte de non-modification ; exigence de cohérence, responsive et accessibilité.

**Ambiguïtés à rendre exécutables :** « premium » ne donne ni hiérarchie ni budgets ; « 2D/3D » ne prouve pas la présence d’assets ; « respecter shadcn » doit préciser Base UI ; « global » inclut l’accueil, le guide, les états et la coque, mais ne justifie pas de réécrire les protocoles métier.

**R :** le prompt [07](07-cursor-implementation-brief.md) ajoute audit avant édition, liste de fichiers, un lot à la fois, tests de régression comportementaux, preuve avant/après, revue des contrats et sortie explicite en cas de dépendance non validée. Il ne prétend pas corriger un prompt externe non fourni.
