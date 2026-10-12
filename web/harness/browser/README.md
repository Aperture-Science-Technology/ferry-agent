# FA-UI-ENHANCE-01 — navigateur

Ce harnais rend les composants réels et la feuille de styles de l’application avec des données fictives. Les appels, l’authentification et la navigation sont remplacés localement ; il n’envoie aucune demande à un compte réel. Les polices chargées par le layout Next.js ne sont pas chargées ici.

Depuis `web/`, démarrer le serveur local :

```sh
npx vite --config harness/browser/vite.config.mts
```

Dans un autre terminal, toujours depuis `web/`, utiliser un Playwright déjà disponible :

```sh
node harness/browser/check.mjs
```

Si Playwright est installé hors du projet, définir `PLAYWRIGHT_MODULE` avec le chemin de son paquet existant. Le script ne télécharge rien et n’ajoute aucune dépendance. Il génère les captures dans `captures/`, ainsi que `captures/checks.json` avec les mesures.

Vérifications : largeur du document à 320/390/1280 px, absence de chevauchement des actions d’en-tête, listes et états vides, sélection et dialogues de lot, filtres mobiles, palette FR/EN, Tab/Maj+Tab, Échap et retour du focus à l’élément depuis lequel le raccourci a été utilisé. Les tests de comportement et d’échecs partiels sont dans `../ui-enhancements.render.test.tsx`.
