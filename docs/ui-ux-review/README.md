# Revue produit et design — Ferry Agent

Documentation de référence pour l’agent Cursor chargé de la refonte. Rédigée le **15 septembre 2026**, à partir du checkout `main`, HEAD `a42a80e76f96edb21deb218bff80c110f4e968c1`. Les références de fichiers sont relatives à la racine du dépôt ; les liens utilisent `../../` lorsque nécessaire.

## Invariant produit

**Ferry Agent est une webapp cloud.** Bibliothèque, appareils, livraisons, sources et réglages se gèrent dans la webapp. **Seul le Gateway est local/self-hosted** : il exécute notamment les téléchargements torrent et communique avec Prowlarr. Son installation n’est pas le prérequis général à l’utilisation du service. Ce cadrage est imposé par la demande de revue ; les textes actuels contradictoires sont des éléments à corriger, pas une définition du produit.

## Lire et utiliser le dossier

| Document | Usage |
|---|---|
| [00 — Synthèse](00-executive-summary.md) | Priorités, risques, décisions à préparer |
| [01 — Audit de l’existant](01-current-state-audit.md) | Preuves, parcours réels, historique et limites des contrôles |
| [02 — Modèle produit et UX](02-product-ux-model.md) | Frontière cloud/local, navigation et parcours cibles |
| [03 — Direction artistique](03-art-direction.md) | Principes visuels, tokens, typographie et responsive |
| [04 — Interactions et mouvement](04-interaction-motion.md) | États, clavier, focus, animations et retours système |
| [05 — Spécifications des écrans](05-screen-specifications.md) | Composition, actions, données et critères de recette |
| [06 — Inventaire](06-component-and-asset-inventory.md) | Réemploi réel, composants et assets à produire |
| [07 — Brief Cursor](07-cursor-implementation-brief.md) | Prompt directement utilisable pour l’implémentation |
| [08 — Feuille de route](08-implementation-roadmap.md) | Lots, dépendances, tests et critères de sortie |
| [Brand kit](brand-kit.md) | Identité FA-UI-BRAND-01 : logo, variantes, illustrations, règles d’usage |

Lire 00 → 01 → 02 avant de choisir un lot. Utiliser 03 à 06 conjointement, puis transmettre 07 avec 08. Le brief ne remplace pas l’inspection du checkout par Cursor.

## Statut des énoncés

- **F — Fait** : observé dans les fichiers cités ou dans une commande explicitement rapportée. Cela ne garantit ni disponibilité en production ni bon rendu dans un navigateur.
- **I — Problème inféré** : conséquence probable du code ou de l’organisation ; à confirmer par reproduction ou test utilisateur.
- **R — Recommandation** : comportement ou design cible, non implémenté par cette revue.
- **V — Vérification** : commande réellement exécutée et résultat, avec ses limites.

Les chapitres 02 à 08 sont prescriptifs : sauf blocs « Fait », leurs propositions sont des **R**. Aucun nouveau choix d’architecture n’est entériné ici. Si un choix devient une décision d’implémentation, appliquer la règle ADR de [AGENTS.md](../../AGENTS.md) ; cette mission n’autorise aucune écriture sous `docs/adr/`.

## Périmètre et limites

**V :** lecture des routes, composants, styles, traductions, assets publics, contrats API pertinents, workflow CI et historique Git ; contrôle i18n et lint web exécutés. Les résultats détaillés figurent dans [01](01-current-state-audit.md).

**Aucun rendu web lancé ou capturé.** Pas de capture, de mesure Lighthouse, de test clavier réel ou de certification d’accessibilité. Pas de connexion Clerk, de livraison, d’OAuth, d’installation Gateway ni de lecture sur liseuse réalisés. Aucun statut de CI distante n’a été consulté. Aucun build exécuté : il produirait des fichiers hors du répertoire documentaire autorisé ; `next dev` peut aussi régénérer des fichiers d’instructions, comme le précise [web/AGENTS.md](../../web/AGENTS.md).

Le prompt de refonte séparé n’a pas été trouvé dans les fichiers suivis ni dans les noms de fichiers non ignorés examinés hors dépendances et caches. La demande de cette conversation est donc le **seul prompt source disponible** ; son analyse est dans [01](01-current-state-audit.md), son adaptation exécutable dans [07](07-cursor-implementation-brief.md). Un prompt externe éventuel devra être confronté à ce dossier.

Seuls les dix fichiers Markdown de ce répertoire sont créés. Aucun code, asset ou fichier de configuration existant modifié ; aucun commit ni changement de branche.
