# Brand kit — Ferry Agent (FA-UI-BRAND-01)

Première identité visuelle propriétaire, avant la refonte des écrans.  
Ferry Agent est une **webapp cloud** ; seul le **Gateway** est local/self-hosted. Ne pas représenter toute la plateforme comme auto-hébergée.

## Provenance

- **Création originale** pour Ferry Agent (septembre 2026), lot `FA-UI-BRAND-01`.
- Aucune reprise ni redistribution d’assets Blush, unDraw, Open Peeps ou d’autres banques d’illustration génériques.
- Symbole et illustrations dessinés en SVG vectoriel maison ; pas de bibliothèque d’icônes pour la marque.
- Wordmark dans l’UI : police produit **Fraunces** (`font-heading`). Les fichiers `logo-*.svg` embarquent un wordmark système pour usage autonome hors app.

## Concept du symbole

Livre ouvert + arc de **passage** (transfert d’un livre d’un point à un autre).  
Ce n’est **pas** une icône de bateau. Le motif reste lisible à 16×16 px.

## Palette (alignée `03-art-direction.md`)

| Rôle | Valeur | Usage marque |
|---|---|---|
| Fond icône | `#111C23` | App icon / favicon |
| Encre (fond sombre) | `#EDF3F1` | Pages du livre |
| Secondaire | `#B0C0C0` | Gouttière / détails |
| Accent | `#93D3C7` | Arc de passage |
| Encre (fond clair) | `#111C23` | Variante light |
| Accent light | `#2F7A6E` | Arc sur fond clair |

L’UI continue d’utiliser les tokens sémantiques (`background`, `foreground`, `chart-1`, etc.). Le symbole inline du composant `BrandLogo` utilise `currentColor`.

## Assets créés

### Identité — `web/public/brand/`

| Fichier | Rôle | ViewBox / taille |
|---|---|---|
| `symbol.svg` | Symbole `currentColor` | 32×32 |
| `symbol-dark.svg` | Symbole pour fond sombre | 32×32 |
| `symbol-light.svg` | Symbole pour fond clair | 32×32 |
| `symbol-mono.svg` | Monochrome `currentColor` | 32×32 |
| `logo-dark.svg` | Symbole + wordmark (fond sombre) | 168×32 |
| `logo-light.svg` | Symbole + wordmark (fond clair) | 168×32 |
| `logo-mono.svg` | Lockup monochrome | 168×32 |
| `app-icon.svg` / `favicon.svg` | Icône app (fond + symbole) | 32×32 |
| `app-icon-32.png`, `app-icon-180.png`, `app-icon-512.png` | Raster app icon | 32 / 180 / 512 |
| `favicon.ico` | Favicon multi-taille (16/32/48) | ICO |

Budget : chaque SVG d’identité ≈ 0,9–1,2 Ko (cible ≤ 20 Ko).

### Métadonnées Next — `web/app/`

| Fichier | Rôle |
|---|---|
| `icon.svg` | Icône App Router |
| `favicon.ico` | Favicon navigateur |
| `apple-icon.png` | Apple touch icon 180×180 |

### Illustrations 2D — `web/public/illustrations/`

| Fichier | Rôle | ViewBox | Budget |
|---|---|---|---|
| `empty-library.svg` | État vide bibliothèque en ligne | 160×120 | ≈ 1,4 Ko |
| `cloud-gateway.svg` | Service cloud (gauche) + Gateway local (droite) | 200×120 | ≈ 1,9 Ko |

Grammaire commune : formes simples, angle constant, accent sarcelle unique, surfaces `#192830` / `#22343D`, **aucun texte FR/EN dans le SVG**.

### Composants

| Composant | Chemin | Usage |
|---|---|---|
| `BrandMark` / `BrandLogo` | `web/components/brand-logo.tsx` | Header public, sidebar, footer |
| `EmptyLibraryIllustration` / `CloudGatewayIllustration` | `web/components/illustrations.tsx` | Prêts pour empty states / schéma cloud-local (lots suivants) |

Intégration actuelle (minimale, sans restructuration de layout) :

- `web/components/marketing/site-header.tsx`
- `web/components/marketing/site-footer.tsx`
- `web/components/app/app-sidebar.tsx`

Labels accessibles : namespace next-intl `brand.name` / `brand.logoAlt` (FR/EN symétriques).

## Règles d’usage

1. **Espace libre** : laisser au moins ≈ 1/8 de la hauteur du symbole autour du mark.
2. **Taille minimale** : symbole ≥ 16 CSS px ; lockup avec wordmark ≥ 24 px de hauteur de mark.
3. **Fonds** : `*-dark` sur surfaces sombres ; `*-light` sur surfaces claires ; `*-mono` / `currentColor` quand la couleur vient du thème.
4. **Ne pas** : étirer, ajouter d’ombre/glow, recolorier l’arc hors palette, remplacer le symbole par une icône Lucide « ship », ni coller le logo sur une photo chargée sans contraste vérifié.
5. **Cloud vs Gateway** : l’illustration `cloud-gateway` montre deux zones ; les légendes restent en HTML traduit. Ne pas légender le SVG.
6. **États vides** : illustration ≤ 160–200 px de large, décorative (`alt=""`) si le message adjacent porte le sens.

## Limites de ce lot

- Pas de thème clair complet ni de toggle.
- Pas de dépendance 3D, Rive ou moteur d’animation.
- Illustrations non encore branchées sur tous les empty states (volontaire : fondations avant refonte d’écrans).
- Pas de validation visuelle navigateur dans la session d’implémentation si le navigateur n’a pas pu être lancé — à vérifier manuellement (header / sidebar / favicon 16 px / mobile).

## Usages prévus (lots suivants)

- Empty state bibliothèque → `EmptyLibraryIllustration`
- Accueil / guide Gateway → `CloudGatewayIllustration` + légendes HTML cloud/local
- Favicon / PWA / partages → fichiers sous `web/public/brand/` et `web/app/`
