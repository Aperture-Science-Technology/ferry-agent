# 03 — Direction artistique et système visuel

## 1. Intention — R

Une bibliothèque contemporaine, calme et précise. La sensation premium vient de l’équilibre typographique, des espacements constants, de la qualité des états et du soin apporté aux couvertures. Éviter les tableaux de bord remplis de statistiques arbitraires, les cartes empilées pour chaque phrase, les halos multiples et les éléments flottants permanents.

**F :** le dépôt possède déjà des polices Geist/Fraunces, une palette sombre bleu-vert et des accents sarcelle/ciel (`web/app/[locale]/layout.tsx`, `web/app/globals.css`). **R :** affiner cette direction et la généraliser ; ne pas importer une identité concurrente.

## 2. Grammaire visuelle — R

- **Encre** : fond peu saturé, surfaces différenciées sans multiplier les panneaux.
- **Papier** : chaleur légère des textes et des couvertures ; pas de texture derrière un formulaire ou une table.
- **Passage** : un trait ou une liaison graphique discrète pour exprimer le transfert du livre. Réserver le dégradé à une signature ponctuelle, pas à tous les sous-titres.
- **Précision** : bordures utiles aux regroupements, ombres réservées aux objets superposés, dates et statuts lisibles.
- **Respiration** : une action dominante par contexte, groupes rapprochés et sections nettement séparées.

## 3. Tokens proposés

Valeurs de départ **non appliquées et non validées sur rendu**. Réutiliser les variables sémantiques de `web/app/globals.css` ; introduire des noms de marque/état si nécessaire au lieu de donner à `chart-1` toutes les fonctions.

| Rôle | Proposition sombre | Emploi |
|---|---|---|
| Fond | `#111C23` | Page |
| Surface | `#192830` | Formulaire, rangée sélectionnée, carte utile |
| Surface élevée | `#22343D` | Dialog, menu |
| Texte principal | `#EDF3F1` | Titres et contenu |
| Texte secondaire | `#B0C0C0` | Aide et métadonnées |
| Accent | `#93D3C7` | Action principale, sélection ; texte sombre sur bouton plein |
| Bordure discrète | `#34474E` | Séparation décorative |
| Contour de contrôle | `#70868C` | Identification des champs lorsque la bordure est nécessaire |
| Focus | `#B2E5DB` | Anneau visible distinct du hover |
| Réussite | `#A5D6B7` | Icône + texte, pas couleur seule |
| Attention | `#E6C480` | Action requise ou donnée incertaine |
| Erreur | `#F1A5A3` | Explication et contrôle invalide |

Mesurer les combinaisons finales, y compris transparences, états désactivés, images et placeholders. Viser 4,5:1 pour le texte courant, 3:1 pour le grand texte et les éléments graphiques nécessaires. Ces seuils s’appuient sur les critères de contraste du [référentiel WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/). Une bordure purement décorative n’est pas un indicateur d’état.

**Thème :** cible initiale sombre cohérente avec l’existant. Un thème clair complet est un lot éventuel, avec tokens, états et illustrations adaptés ; ne pas ajouter un toggle avant cette déclinaison. **F :** le layout impose actuellement `dark`, malgré la présence de valeurs racines claires (`web/app/[locale]/layout.tsx`, `web/app/globals.css`).

### Typographie

| Usage | Police | Taille / interligne cible |
|---|---|---|
| Hero | Fraunces, medium | 36–60 px / 1,08 selon largeur |
| Titre de page | Fraunces, medium | 28–36 px / 1,18 |
| Titre de section | Geist, semibold ; Fraunces ponctuellement éditorial | 20–24 px / 1,3 |
| Titre de livre | Geist, medium | 15–17 px / 1,4 |
| Corps et champs | Geist | 16 px / 1,5 à 1,6 |
| Métadonnées | Geist | 14 px / 1,45 |
| Codes à copier | Geist Mono | 13–14 px / 1,5 |

Texte long limité à environ 65 caractères par ligne. Deux lignes de titre possibles dans les listes ; détails permettant de lire le titre complet. Les petits caractères ne doivent pas devenir le style par défaut du produit. Conserver les polices déjà chargées ; vérifier les sauts de mise en page pendant leur chargement.

### Espacement et formes

- Échelle : 4, 8, 12, 16, 24, 32, 48, 64 px.
- Marges latérales : 16 px sur petit mobile, 24 px sur tablette, 32 px sur grand écran.
- Espace entre titre et outils : 24 px ; entre sections : 32–48 px dans l’app, 64–96 px sur l’accueil.
- Rayons : 8 px contrôles, 12 px surfaces, 16 px dialogs et illustrations. Pill réservé au badge.
- Contrôles confortables : hauteur visée 44 px pour actions et champs tactiles ; lignes de table 56–72 px selon contenu. La cible 44 px est un choix de confort, pas la taille minimale AA de tous les contrôles.
- Icônes Lucide : 18–20 px dans les actions, 16 px avec métadonnée, épaisseur homogène. Ne pas dessiner une nouvelle famille d’icônes pour les actions standards.

## 4. Composition et responsive — R

| Largeur de recette | Coque | Contenu |
|---|---|---|
| 320–767 px | Menu en volet, titre court, langue et compte compacts | Une colonne ; actions pleine largeur si besoin ; filtres regroupés |
| 768–1023 px | Sidebar et contenu à vérifier ensemble ; repli possible | Choisir cartes ou table selon **largeur utile**, pas seulement viewport |
| 1024–1439 px | Sidebar 240–256 px, header stable | Grille de livres 3–4 colonnes selon largeur utile ; tableaux lisibles |
| ≥1440 px | Largeur utile bornée, marges équilibrées | Contenu courant max 1200–1280 px ; formulaires 640–720 px |

**F :** la sidebar mobile bascule à 768 px ; plusieurs tableaux apparaissent également à `md`, alors qu’une sidebar de 16 rem réduit l’espace restant (`web/hooks/use-mobile.ts`, `web/components/ui/sidebar.tsx`, `web/components/app/deliveries/deliveries-view.tsx`). **I :** 768 px est un point critique pour les tables. **R :** tester l’espace réel avant de choisir le breakpoint ; container query possible si compatible avec l’implémentation retenue.

Ne pas utiliser de largeur fixe pour les textes ou les CTA longs. Le header public garde marque, action principale et menu ; les liens secondaires et le changement de langue peuvent passer dans le menu étroit. Prévoir les barres navigateur et le clavier mobile avec des hauteurs dynamiques et un contenu scrollable.

### Structure cible de la bibliothèque remplie

```text
Navigation | Header : navigation mobile / langue / compte
           | Bibliothèque                   Ajouter des livres
           | Rechercher dans mes livres
           | Nombre de livres · tri · filtres · grille/liste
           | Couvertures et titres ; action Détails / Envoyer
           | Suite de la collection ou pagination, si implémentée
```

Structure cible, pas capture du produit actuel. L’état vide remplace la grille par une explication courte et deux voies d’ajout.

## 5. Illustrations, schémas et 3D — R

Les nouvelles ressources restent **à produire** : inventaire et formats dans [06](06-component-and-asset-inventory.md).

- **2D principale :** livre, liseuse et bibliothèque en ligne liés par un passage discret. Formes simples, angle constant, accent sarcelle unique. Éviter le cloud informatique générique comme illustration dominante de chaque écran.
- **3D facultative :** un livre et une liseuse en volumes mats, éclairage diffus venant du haut gauche, perspective légère, ombre douce ; une image statique responsive, sans WebGL ni rotation permanente.
- **États vides :** petite illustration de livre ou de destination, 120–180 px maximum, complémentaire au message et à l’action.
- **Schéma cloud/local :** deux zones nommées en vrai texte HTML, légende accessible, version verticale mobile. Ne pas intégrer les textes FR/EN dans une image.
- **Couvertures :** objets réels prioritaires ; placeholder sobre, cohérent avec leur ratio, sans fausses couvertures de livres ajoutés.

**R :** budgets initiaux de conception : SVG simple ≤20 Ko, illustration vide ≤40 Ko, image hero ≤180 Ko par taille servie. Ce sont des cibles, pas des mesures actuelles. Réserver les dimensions ; chargement différé hors écran ; une image décorative ne doit pas retarder la première action.

## 6. Critères de revue artistique

À valider sur captures réelles : continuité accueil/app/guide, densité de collection, lecture d’un titre long, tonalité des messages d’échec, distinction des états, absence de duplication d’accent, dialogues plus hauts que le viewport et qualité des images à 1×/2×. Ne pas accepter une direction uniquement sur un écran vide ou un hero isolé.
