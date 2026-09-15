# 00 — Synthèse exécutive

## Conclusion

**R :** achever une refonte cohérente centrée sur la bibliothèque cloud et la fiabilité des parcours. Conserver les fondations visuelles utiles, corriger d’abord le récit produit et les états trompeurs, puis stabiliser la navigation et décliner le système sur tous les écrans.

**F :** une évolution récente existe déjà : `66d1e90` installe la référence bibliothèque et les composants de section/état ; `2e39698`, `53bf570`, `e0364de`, `662b6ab` déclinent les autres écrans ; `a42a80e` termine une itération sur l’accueil et le guide. Vérifiables avec `git show <hash> -- <chemin>` : `web/components/app/library/library-view.tsx`, `web/components/app/deliveries/deliveries-view.tsx`, `web/components/app/devices/devices-view.tsx`, `web/components/app/gateways/gateways-view.tsx`, `web/components/app/settings/settings-form.tsx`, `web/components/marketing/hero.tsx`, `web/components/docs/byo-install-guide.tsx`.

## Priorités

| Priorité | Fait vérifiable | Problème / impact | Recommandation |
|---|---|---|---|
| P0 | `web/messages/fr.json` et `en.json` : `meta.description`, `hero.badge`, `valueProps.items.selfHosted`, `faq.items.selfHosted`, `faq.items.myData` présentent le service comme local | **I :** fausse compréhension du stockage et de la responsabilité de l’utilisateur | Réécrire ensemble accueil, FAQ, métadonnées et guide autour de la webapp cloud et du seul Gateway local |
| P0 | Le Gateway envoie les fichiers à `.../fetch-result` dans `gateway/agent/ferry_gateway_agent/worker.py` ; la bibliothèque est persistée par `src/ferry_agent/services/library.py` | **I :** la promesse « rien n’est stocké chez nous » contredit les flux logiciels | Représenter clairement le transfert Gateway → bibliothèque du service ; ne pas inventer de garanties de confidentialité |
| P0 | `web/components/docs/byo-install-guide.tsx` expose un lien `.tar` unique ; `docs/adr/0005-distribution-canal-gui.md` et `.github/workflows/ci.yml` décrivent les archives par architecture | **I :** parcours d’installation potentiellement divergent du canal adopté | Vérifier réellement fichiers, architecture, import et démarrage avant toute nouvelle instruction d’installation |
| P1 | Le header public masque sa navigation sous `md`, sans menu de remplacement : `web/components/marketing/site-header.tsx` | **I :** guide moins découvrable sur mobile ; risque de débordement avec les deux CTA et les langues | Header compact, menu mobile accessible, un CTA de premier niveau |
| P1 | Le couple `SidebarProvider` / `SidebarInset` et un séparateur contraint structurent la coque : `web/app/[locale]/app/layout.tsx`, `web/components/app/dashboard-header.tsx`, `web/components/ui/sidebar.tsx` | **I :** risque de régression globale si une primitive est remplacée à l’aveugle | Première tranche testée séparément : navigation, largeurs, focus, overlays et langues |
| P1 | Des erreurs deviennent des listes vides : `GatewayRecentActivity` dans `web/components/app/gateways/gateways-view.tsx`, historique de `web/components/app/library/book-detail-dialog.tsx` | **I :** « aucune activité » peut masquer un échec de chargement | États vide, indisponible, partiel et obsolète distincts ; reprise contextuelle |
| P1 | La liste des livraisons reste dans son état initial ; le détail charge une fois : `web/components/app/deliveries/deliveries-view.tsx`, `delivery-detail-dialog.tsx` | **I :** suivi perçu comme bloqué | Actualisation explicite, puis polling borné si nécessaire ; afficher le statut réel |
| P1 | Labels non associés dans plusieurs formulaires, carte mobile de liste bibliothèque uniquement cliquable, copie OPDS sans nom accessible : `new-device-dialog.tsx`, `deliver-dialog.tsx`, `library-view.tsx`, `settings/reader-catalog-section.tsx` sous `web/components/app/` | **I :** parcours difficiles ou inaccessibles au clavier/lecteur d’écran | Contrôles natifs ou Base UI nommés, focus visible, action Détails explicite |
| P2 | `SourcesManager` est monté dans Sources et Réglages : `web/app/[locale]/app/sources/page.tsx`, `web/components/app/settings/settings-form.tsx` | **I :** responsabilité dispersée | Sources devient le lieu principal ; Réglages y renvoie |

## Direction recommandée

- Une bibliothèque éditoriale, calme et lisible ; les couvertures et les titres portent l’identité.
- Fond sombre encre, surfaces mates, accent sarcelle mesuré, typographie de lecture. **F :** Geist/Fraunces et des tokens sombres existent dans `web/app/[locale]/layout.tsx` et `web/app/globals.css`.
- Hiérarchie : bibliothèque possédée → ajout/recherche → envoi → suivi. Le Gateway est une capacité complémentaire expliquée au bon moment.
- Des illustrations 2D fonctionnelles et un éventuel visuel 3D statique pour l’accueil. **F :** aucun kit d’illustrations Ferry ni modèle 3D n’apparaît dans `web/public/` ; voir l’inventaire exact [06](06-component-and-asset-inventory.md).
- Une animation confirme une action ou aide à comprendre une transition ; elle ne retarde pas l’accès aux livres.

## Vérifications réelles

**V :** `node web/scripts/check-i18n-keys.mjs` passe : **519 clés par langue**. `npm run lint` depuis `web/` échoue : **11 erreurs, 1 avertissement**. Sources de ces contrôles : `web/scripts/check-i18n-keys.mjs`, `web/package.json`, `web/eslint.config.mjs` ; détail dans [01](01-current-state-audit.md).

**F :** `.github/workflows/ci.yml` construit le web et contrôle la symétrie i18n ; il ne lance pas `npm run lint` dans le job web. **I :** une construction réussie ne démontre donc pas une qualité frontend complète. **V :** la CI distante et le rendu visuel n’ont pas été validés.

## Ambiguïtés à résoudre lors de l’implémentation

1. Prompt externe de refonte éventuel : absent du périmètre consulté.
2. « Accès » ou « Gateway » : recommandation « Gateway » accompagné de « Module installé chez vous » ; conserver l’URL existante.
3. Contrats de production : hébergement, sauvegarde/rétention, disponibilité des fournisseurs cloud et des artefacts Gateway non vérifiés. Ne pas les transformer en promesses marketing.
4. Sens du statut `delivered` : le service marque l’envoi email/cloud terminé après l’opération correspondante, sans preuve de lecture sur une liseuse (`src/ferry_agent/services/delivery.py`). La copie doit refléter cette limite.
5. Thème clair, reprise persistante des tâches, nouvelle pagination et éventuelle exposition du quota : extensions à cadrer, pas des fonctionnalités présentes à simplement relooker (`web/app/[locale]/layout.tsx`, `web/lib/use-gateway-job.ts`, `src/ferry_agent/schemas.py`).

La refonte complète est découpée en lots dans [08](08-implementation-roadmap.md). Aucun lot sensible ne sera déclaré terminé sur la seule base d’une capture desktop.
