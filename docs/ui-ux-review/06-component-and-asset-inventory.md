# 06 — Inventaire des composants et assets

## 1. Règles d’utilisation

**F** signifie présent dans le checkout audité, pas nécessairement utilisé. **R** signifie réemploi, évolution ou création proposée. Les ressources futures ci-dessous ne sont **ni générées ni ajoutées** par cette revue.

Les dépendances verrouillées sont Next 16.3.4, React 19.2.8, Base UI 1.7.0, shadcn 4.20.1, Tailwind 4.3.3, Motion 13.2.0, Lucide 1.40.0 et next-intl 4.14.2 (`web/package-lock.json`). Le manifeste `web/package.json` emploie des plages pour plusieurs de ces versions. Ne pas confondre manifeste, lockfile et capacités réellement intégrées.

## 2. Primitives présentes — F

**24 fichiers** dans `web/components/ui/`. Cette liste est exhaustive pour ce répertoire au HEAD audité.

| Fichiers dans `web/components/ui/` | Usage constaté / recommandation |
|---|---|
| `button.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `textarea.tsx`, `switch.tsx` | F : formulaires et contrôles métier. R : confort tactile, associations de labels, états erreurs, conserver `render` Base UI |
| `dialog.tsx`, `sheet.tsx`, `sidebar.tsx` | F : fenêtres, navigation responsive. R : traduction des noms, hauteur/scroll, focus, politique motion |
| `card.tsx`, `table.tsx`, `separator.tsx` | F : surfaces et listes. R : densité maîtrisée ; ne pas modifier globalement le stretch du séparateur sans recette header |
| `badge.tsx`, `alert.tsx`, `skeleton.tsx`, `progress.tsx`, `sonner.tsx` | F : états et feedback. R : états sémantiques cohérents, annonces, thème et messages simples |
| `accordion.tsx`, `tooltip.tsx` | F : FAQ/guide et aide de navigation. R : préserver usage clavier et noms accessibles |
| `avatar.tsx`, `breadcrumb.tsx`, `dropdown-menu.tsx`, `scroll-area.tsx`, `tabs.tsx` | F : présents, aucun import direct `@/components/ui/<nom>` trouvé dans `web/app/` et `web/components/` au moment de l’audit. R : disponibles si pertinents, pas déjà montés dans un parcours |

**F :** pas de fichier local `command.tsx`, `pagination.tsx`, `form.tsx`, `drawer.tsx`, `alert-dialog.tsx` ou composant DataTable dédié dans ce répertoire. **R :** si nécessaire, annoncer une création et son rôle ; ne pas supposer qu’un catalogue shadcn externe décrit le code local. La documentation [shadcn Sidebar Base UI](https://ui.shadcn.com/docs/components/base/sidebar) est une référence secondaire ; les signatures et comportements du dépôt priment.

## 3. Composants produit présents — F et évolution proposée

| Ensemble | Chemins existants | Réemploi recommandé |
|---|---|---|
| Coque | `web/components/app/app-sidebar.tsx`, `dashboard-header.tsx`, `page-header.tsx` | Garder les responsabilités ; adapter ordre, responsive, langue et focus |
| Structure | `web/components/app/section-header.tsx`, `state-panel.tsx`, `empty-state.tsx` | Unifier titres et états ; limiter les filets dégradés répétés |
| Bibliothèque | `web/components/app/library/library-view.tsx`, `cover-image.tsx`, `upload-dropzone.tsx` | Réorganiser la collection ; préserver import réel et accès authentifié aux couvertures |
| Livre | `web/components/app/library/book-detail-dialog.tsx`, `book-edit-dialog.tsx`, `deliver-dialog.tsx` | Réemployer logique métier et contrats ; faire évoluer les surfaces de détail/envoi |
| Livraisons | `web/components/app/deliveries/deliveries-view.tsx`, `delivery-detail-dialog.tsx` | Ajouter une actualisation fiable et harmoniser le sens des états |
| Appareils | `web/components/app/devices/devices-view.tsx`, `new-device-dialog.tsx`, `edit-device-dialog.tsx`, `cloud-link-dialog.tsx`, `conversion-profile-field.tsx` | Préserver champs, modèles, conversion et protocole OAuth |
| Marques | `web/components/app/devices/brand-badge.tsx`, `brand-logos.tsx` | Kindle/Kobo en SVG inline ; Tolino/PocketBook textuels ; autre marque en Lucide |
| Gateway | `web/components/app/gateways/gateways-view.tsx`, `create-gateway-dialog.tsx` | Réemployer création et panneau des deux secrets, gestion de l’expiration et du polling |
| Sources | `web/components/app/sources/sources-manager.tsx` | Surface unique de gestion, états fiables |
| Réglages | `web/components/app/settings/settings-form.tsx`, `reader-catalog-section.tsx`, `catalog-qr-code.tsx` | Sauvegarde explicite, lien sensible et QR réel |
| Marketing | `web/components/marketing/site-header.tsx`, `site-footer.tsx`, `hero.tsx`, `how-it-works.tsx`, `delivered.tsx`, `value-props.tsx`, `mcp-spotlight.tsx`, `faq.tsx` | Réécrire le récit cloud/local et appliquer la même grammaire visuelle |
| Guide | `web/components/docs/byo-install-guide.tsx` | Restructurer après vérification du parcours d’installation |
| Commun | `web/components/locale-switcher.tsx`, `status-dot.tsx`, `motion/reveal.tsx` | Locale, état ponctuel, mouvement réduit systématique |

## 4. Assets statiques présents — F

| Chemin | Taille en octets mesurée | Observation / suite |
|---|---:|---|
| `web/public/brands/kindle.svg` | 6 987 | SVG de marque présent |
| `web/public/brands/kindle2024.svg` | 8 476 | SVG de marque avec métadonnées Inkscape ; variante distincte |
| `web/public/brands/kobo.svg` | 1 687 | SVG de marque présent |
| `web/public/file.svg` | 391 | Ressource générique |
| `web/public/globe.svg` | 1 035 | Ressource générique |
| `web/public/next.svg` | 1 375 | Ressource Next |
| `web/public/vercel.svg` | 128 | Ressource Vercel |
| `web/public/window.svg` | 385 | Ressource générique |
| `web/app/favicon.ico` | Non mesurée dans ce tableau | Icône d’application présente ; aspect non inspecté visuellement |

**V :** inventaire par système de fichiers et inspection de références, pas visualisation des SVG/ICO. Aucune référence directe aux huit chemins publics n’a été trouvée dans les composants/app examinés ; les marques affichées passent par `brand-logos.tsx` et `brand-badge.tsx`. Avant retrait ultérieur d’une ressource, rechercher aussi les références CSS, métadonnées et externes. Aucun retrait dans cette mission.

**F :** pas d’illustration Ferry, photo, texture, modèle 3D, vidéo ou fichier Lottie dans `web/public/` inventorié. Le nom Ferry Agent dans les headers est du texte, pas un logo image dédié (`web/components/app/app-sidebar.tsx`, `web/components/marketing/site-header.tsx`).

## 5. Ressources dynamiques — F

- **Couverture possédée :** appel authentifié `/api/v1/covers/{itemId}`, URL blob, composant Next Image non optimisé, révocation à la sortie (`web/components/app/library/cover-image.tsx`, `src/ferry_agent/api/covers.py`). Ne pas remplacer par une URL privée exposée dans le HTML.
- **Couverture de recherche :** URL issue du résultat, `SearchCoverImage` avec `unoptimized`, validation côté service ; domaines déclarés également dans `web/next.config.ts` (`src/ferry_agent/services/covers.py`). Ne pas présumer que `remotePatterns` apporte toutes les protections lorsque l’optimisation est désactivée.
- **QR catalogue :** `QRCode.toDataURL`, taille par défaut 180, marge 1, correction M (`web/components/app/settings/catalog-qr-code.tsx`). Le commentaire dit SVG, mais l’implémentation utilise une data URL ; ne pas inventer de SVG statique dans l’inventaire.
- **Icônes :** imports `lucide-react` dans les composants ; aucune nécessité d’un sprite custom pour les actions standards (`web/package.json`, `web/components/app/app-sidebar.tsx`).
- **Polices :** `next/font/google` pour Geist, Geist Mono et Fraunces (`web/app/[locale]/layout.tsx`) ; pas de fichiers de polices dans les assets publics inventoriés.

## 6. Composants à créer ou à formaliser — R

Noms indicatifs, **aucun fichier correspondant n’est présumé existant**. Choisir extraction ou extension après audit des usages.

| Proposition | Responsabilité | Dépendances / états obligatoires |
|---|---|---|
| Menu public mobile | Navigation de l’accueil et du guide | Sheet ou DropdownMenu existant ; focus, langue, connecté/non connecté |
| Barre d’outils bibliothèque | Recherche locale, filtres, vue et ajout | Input/Select/Button ; collection vide, filtres actifs, contexte conservé |
| Espace d’ajout de livres | Séparer import et recherche sources | UploadDropzone, recherche actuelle ; réutiliser logique et états |
| Indicateur d’état métier | Libellé + icône + style par état | Badge existant ; mapping delivery/Gateway distincts |
| Surface de lecture en erreur | Erreur, reprise, données partielles | StatePanel/Alert ; pas seulement un toast |
| Bloc de copie | Valeur sélectionnable et vraie confirmation | Bouton/Input existants ; attente, copie refusée, succès ; variante secrets |
| Schéma cloud/local | Expliquer les responsabilités | HTML/SVG accessible, libellés next-intl, disposition responsive |
| Illustrations d’état vide | Renforcer la compréhension | Asset optionnel avec dimensions et alternative ; CTA toujours en HTML |

Ne pas inventer de couche abstraite de formulaires ou de gestion des données pour uniformiser uniquement les couleurs. Toute décision de nouvelle architecture acceptée relève d’un ADR, conformément à `AGENTS.md`.

## 7. Plan de production des assets — R

Les chemins ci-dessous sont des **destinations futures proposées**, hors des écritures autorisées dans cette revue.

| ID / destination proposée | Rôle et brief | Format / budget cible | Accessibilité / validation |
|---|---|---|---|
| A01 `web/public/illustrations/library-to-reader.svg` | 2D : livre, collection en ligne, liseuse ; trajet doux, peu d’objets | SVG, ≤20 Ko | Légendes HTML, alternative si informative ; mobile sans texte coupé |
| A02 `web/public/illustrations/reader-still.webp` | 3D statique facultative : livre/liseuse mats, éclairage diffus, aucun logo inventé | WebP/AVIF, tailles 480/960/1440 ; ≤180 Ko par variante | Décorative si A01 porte déjà le sens ; pas de texte incrusté |
| A03 `web/public/illustrations/empty-library.svg` | Un livre ouvert, invitation calme | SVG, ≤20 Ko | `alt=""` si message adjacent équivalent |
| A04 `web/public/illustrations/empty-devices.svg` | Silhouette simple de liseuse, sans marque | SVG, ≤20 Ko | Ne pas suggérer une compatibilité non vérifiée |
| A05 schéma rendu dans un composant à créer | Zones « Service en ligne » / « Chez vous », flèches explicites | HTML + SVG simple, pas de moteur de graphe requis | Ordre de lecture logique ; alternative textuelle ; légendes FR/EN |
| A06 déclinaison d’identité/favicon | Monogramme ou signe à proposer seulement si nécessaire | SVG source + ICO/PNG dérivés | Vérifier 16/32 px et absence de confusion avec marques tierces |

Pour chaque asset produit ultérieurement, documenter source/licence ou méthode de création, date, dimensions, taille, variante claire/sombre éventuelle, recadrage, nom accessible et emplacement. Revoir les droits des logos tiers avant réutilisation marketing ; leur présence dans le dépôt n’atteste pas une autorisation élargie. Aucune provenance de licence n’est inventée ici.

Ordre recommandé : schéma fonctionnel A05 → 2D A01 et A03/A04 → 3D A02 si elle apporte un bénéfice → identité A06 si retenue. La refonte fonctionnelle ne dépend pas d’une illustration encore absente.
