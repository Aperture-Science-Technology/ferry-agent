# Rapport FA-DELIVERY-TRUTH-01

W1 à W5 implémentés dans le dépôt. Aucune commande git, aucun commit, aucune publication et aucune nouvelle dépendance déclarée.

Les vérifications locales demandées passent. La CI distante n’a pas été déclenchée : je ne prétends donc pas que sa condition « CI verte » a été constatée.

## 1. Fichiers modifiés ou ajoutés

Inventaire établi par empreintes SHA-256 avant/après, sans commande git ; il décrit les changements de cette session.

- `openapi.json` — Contrat régénéré : champ de sortie terminal additif, sans retrait de champ.
- `src/ferry_agent/schemas.py` — Calcule terminal selon le statut et la méthode, sans colonne ni migration.
- `src/ferry_agent/services/library.py` — Centralise le nom public, enrichit les nouveaux imports, conserve les valeurs existantes et supprime la couverture avec le livre.
- `src/ferry_agent/services/book_metadata.py` — Lit les métadonnées et couvertures EPUB avec la bibliothèque standard, les PDF avec PyMuPDF déjà déclaré ; nettoie les noms de release.
- `src/ferry_agent/services/opds.py` — Utilise le nom public pour le format du flux et annonce le vrai type des couvertures locales.
- `src/ferry_agent/services/mailer.py` — Transmet le titre propre au sujet Kindle, avec repli Votre document et idempotence déterministe conservée.
- `src/ferry_agent/services/covers.py` — Résout le marqueur de couverture locale vers un fichier voisin du livre, sans ouvrir un chemin fourni par le client.
- `src/ferry_agent/services/delivery.py` — Nomme les pièces jointes et uploads cloud à partir du livre, en conservant la vérification du format réel.
- `src/ferry_agent/api/opds.py` — Sert les téléchargements sous le nom public et les couvertures EPUB via le catalogue autorisé.
- `src/ferry_agent/api/covers.py` — Sert les couvertures EPUB après le contrôle de propriété existant ; conserve le cache distant.
- `tests/test_cloud_links.py` — Remplace les trois attentes book.epub/book.pdf par Herbert - Dune au même format, sans retirer les contrôles de contenu et de succès.
- `tests/test_delivery_tier_a.py` — Adapte les doublures au titre optionnel et les trois attentes de nom de pièce jointe au nom public.
- `tests/test_conversion_profiles.py` — Adapte une doublure mailer au titre optionnel sans changer les assertions de conversion.
- `tests/test_delivery_truth.py` — Ajoute les régressions sur noms, sujet, idempotence, vingt combinaisons de statut, EPUB, couverture, PDF honnête et trois canaux de livraison.
- `tests/integration/test_delivery_out_enrichment.py` — Vérifie via HTTP et Postgres que sent email est terminal et sent Drive actif.
- `tests/integration/test_gateway_import.py` — Vérifie les métadonnées et la couverture après import EPUB et rechargement réel depuis Postgres.
- `gateway/image/README.md` — Documente les variables Prowlarr, leur priorité, la lecture des identifiants et l’ajout indispensable d’un indexeur.
- `gateway/image/entrypoint.sh` — Accepte les deux variables Prowlarr ensemble, persiste les valeurs effectives en 0600 et conserve le mode généré.
- `gateway/image/ensure_prowlarr_user.py` — Lit les valeurs persistées exactes, y compris les espaces dans le mot de passe, pour le compte Forms.
- `gateway/dist/compose.yaml` — Expose PROWLARR_USER et PROWLARR_PASSWORD avec des valeurs par défaut vides.
- `gateway/dist/install.sh` — Affiche URL, utilisateur généré et commande de lecture des identifiants, sans imprimer le secret.
- `gateway/agent/tests/test_image_credentials.py` — Exécute les vraies fonctions shell dans un dossier jetable puis le lecteur Forms ; couvre génération, réemploi, remplacement et rejets.
- `web/lib/api-types.generated.ts` — Régénère le type DeliveryOut avec terminal en lecture seule.
- `web/harness/delivery-truth.render.test.tsx` — Vérifie compteurs et filtres email/cloud, détail et retour d’envoi, adresse API et échecs 401/500.
- `web/harness/docs-guide-polish.render.test.tsx` — Compte le nouveau bloc de commande et vérifie les instructions indexeur et document personnel dans les deux langues.
- `web/harness/deliveries-list.render.test.tsx` — Aligne les données de test sur le champ terminal renvoyé par le serveur.
- `web/harness/deliveries-pen-rebuild.render.test.tsx` — Inverse les anciens libellés et compteurs qui maintenaient un email accepté parmi les envois actifs.
- `web/messages/fr.json` — Ajoute les libellés email/cloud, indications Amazon et chapitres du guide en français simple.
- `web/messages/en.json` — Ajoute les traductions anglaises avec exactement les mêmes 900 clés que le français.
- `web/components/docs/byo-install-guide.tsx` — Ajoute les chapitres Ajouter un indexeur et Recevoir un document sur Kindle, sans modifier l’en-tête.
- `web/components/app/library/deliver-dialog.tsx` — Affiche le rappel Amazon avant l’envoi email et traduit le statut dans le retour.
- `web/components/app/library/library-view.tsx` — Affiche le retour email et son adresse à approuver près du début de la page après l’envoi.
- `web/components/app/library/book-detail-dialog.tsx` — Applique le libellé sent propre à la méthode dans l’historique du livre.
- `web/components/app/deliveries/deliveries-view.tsx` — Base compteurs, filtre et suivi sur terminal ; affiche le libellé et l’indice propres à l’email.
- `web/components/app/deliveries/deliveries-state.ts` — Centralise la sémantique API et les libellés ; ne recycle ni un état terminal périmé ni un ancien statut à la place d’un inconnu.
- `web/components/app/deliveries/delivery-feedback.tsx` — Ajoute le rappel Amazon partagé, avec adresse obtenue par API et masquée si la lecture échoue.
- `web/components/app/deliveries/deliveries-state.test.ts` — Remplace la classification codée en dur par les assertions terminal, email/cloud, inconnus et rafraîchissement.
- `web/components/app/deliveries/delivery-detail-dialog.tsx` — Arrête le suivi selon terminal et affiche l’indice email, l’adresse d’envoi et le lien Amazon.
- `docs/adr/0014-verite-des-livraisons-et-metadonnees.md` — Consigne les décisions de nommage, enrichissement, stockage des couvertures, contrat de statut et priorité des identifiants.
- `audit/FA-DELIVERY-TRUTH-01-rapport.md` — Rapport français complet, dont sorties finales brutes.
- `~/.hermes/archive/ferry-agent/audits/FA-DELIVERY-TRUTH-01-sorties-brutes.txt` (hors dépôt, 1,4 Mo) — Toutes les captures stdout/stderr, y compris échecs initiaux, réinstallations et audits non bloquants.
- `web/tsconfig.tsbuildinfo` — Cache TypeScript local régénéré par les vérifications ; fichier généré et **non versionné** (ignoré par git), il n'apparaît donc pas dans le commit.

## 2. Vérifications exécutées : sorties réelles

Les blocs ci-dessous reproduisent les fichiers de capture sans paraphrase. Les codes de retour finaux des suites et contrôles obligatoires sont 0. Les sorties des essais précédents et les audits Ruff complets sont conservés dans le journal brut archivé hors dépôt : `~/.hermes/archive/ferry-agent/audits/FA-DELIVERY-TRUTH-01-sorties-brutes.txt`.

### Plateforme, commande exacte du brief

Commande : `env -i PATH=/usr/bin:/bin HOME=/home/glados LANG=C.UTF-8 ./.venv/bin/python -m pytest -q`

```text
ssssssssssssss.sssssssssssssssssssssssssssssssssssssssssssssssssssssssss [ 15%]
ssss.................................................................... [ 30%]
........................................................................ [ 46%]
..............................................ss........................ [ 61%]
........................................................................ [ 77%]
........................................................................ [ 92%]
.................................                                        [100%]
=============================== warnings summary ===============================
.venv/lib/python3.13/site-packages/fastapi/testclient.py:1
  /mnt/HC_Volume_106803131/projects/ferry-agent/.venv/lib/python3.13/site-packages/fastapi/testclient.py:1: StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.
    from starlette.testclient import TestClient as TestClient  # noqa

.venv/lib/python3.13/site-packages/starlette/testclient.py:53
  /mnt/HC_Volume_106803131/projects/ferry-agent/.venv/lib/python3.13/site-packages/starlette/testclient.py:53: DeprecationWarning: The anyio.abc.BlockingPortal alias is deprecated, use anyio.from_thread.BlockingPortal instead.
    _PortalFactoryType = Callable[[], AbstractContextManager[anyio.abc.BlockingPortal]]

tests/test_gateways.py::test_fetch_result_rejects_bad_magic
  /mnt/HC_Volume_106803131/projects/ferry-agent/tests/test_gateways.py:271: StarletteDeprecationWarning: 'HTTP_422_UNPROCESSABLE_ENTITY' is deprecated. Use 'HTTP_422_UNPROCESSABLE_CONTENT' instead.
    await submit_fetch_result(

tests/test_upload_validation.py::TestUploadTooLarge::test_returns_413_and_writes_nothing
  /mnt/HC_Volume_106803131/projects/ferry-agent/src/ferry_agent/api/books.py:145: StarletteDeprecationWarning: 'HTTP_413_REQUEST_ENTITY_TOO_LARGE' is deprecated. Use 'HTTP_413_CONTENT_TOO_LARGE' instead.
    return await _import_uploaded_file(db, user, file)

tests/test_upload_validation.py::TestUploadUnknownFormat::test_plain_text_epub_returns_422_and_writes_nothing
  /mnt/HC_Volume_106803131/projects/ferry-agent/src/ferry_agent/api/books.py:145: StarletteDeprecationWarning: 'HTTP_422_UNPROCESSABLE_ENTITY' is deprecated. Use 'HTTP_422_UNPROCESSABLE_CONTENT' instead.
    return await _import_uploaded_file(db, user, file)

tests/test_users_patch.py::TestUsersPatch::test_rejects_malformed_kindle_email
tests/test_users_patch.py::TestUsersPatch::test_rejects_invalid_default_format
  /mnt/HC_Volume_106803131/projects/ferry-agent/.venv/lib/python3.13/site-packages/fastapi/routing.py:313: StarletteDeprecationWarning: 'HTTP_422_UNPROCESSABLE_ENTITY' is deprecated. Use 'HTTP_422_UNPROCESSABLE_CONTENT' instead.
    return await dependant.call(**values)

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
388 passed, 77 skipped, 7 warnings in 5.60s
```

### Intégration supplémentaire sur Postgres 16 jetable

Commande : `TEST_DATABASE_URL=postgresql+asyncpg://ferry:ferry@127.0.0.1:32768/ferry_test ./.venv/bin/python -m pytest tests/integration -q`

```text
........................................................................ [ 94%]
....                                                                     [100%]
=============================== warnings summary ===============================
tests/integration/test_core_validation_contract.py::test_f05_required_null_preserves_value[default_format]
tests/integration/test_core_validation_contract.py::test_f06_invalid_body_does_not_mutate[[]]
tests/integration/test_core_validation_contract.py::test_f06_invalid_body_does_not_mutate[null]
tests/integration/test_core_validation_contract.py::test_f06_invalid_body_does_not_mutate[42]
tests/integration/test_core_validation_contract.py::test_f06_invalid_body_does_not_mutate["livre"]
tests/integration/test_core_validation_contract.py::test_f06_invalid_body_does_not_mutate[true]
  /mnt/HC_Volume_106803131/projects/ferry-agent/.venv/lib/python3.13/site-packages/fastapi/routing.py:313: StarletteDeprecationWarning: 'HTTP_422_UNPROCESSABLE_ENTITY' is deprecated. Use 'HTTP_422_UNPROCESSABLE_CONTENT' instead.
    return await dependant.call(**values)

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
76 passed, 6 warnings in 51.17s
```

### Agent gateway

Commande : `gateway/agent/.venv/bin/python -m pytest gateway/agent/tests -q`

```text
........................................................................ [ 76%]
......................                                                   [100%]
94 passed in 1.34s
```

### Serveur MCP

Commande : `mcp-server/.venv/bin/python -m pytest mcp-server/tests -q`

```text
........................................................................ [ 69%]
...............................                                          [100%]
103 passed in 5.90s
```

### Web lint

Commande : `cd web && npm run lint`

```text

> web@0.1.0 lint
> eslint


/mnt/HC_Volume_106803131/projects/ferry-agent/web/harness/auth-shell.render.test.tsx
  21:7  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/mnt/HC_Volume_106803131/projects/ferry-agent/web/harness/editorial-sections.render.test.tsx
  33:7  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/mnt/HC_Volume_106803131/projects/ferry-agent/web/harness/hero-pen.render.test.tsx
  42:12  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/mnt/HC_Volume_106803131/projects/ferry-agent/web/harness/how-it-works-pen.render.test.tsx
  20:7  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/mnt/HC_Volume_106803131/projects/ferry-agent/web/harness/why-ferry-pen.render.test.tsx
  20:7  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

✖ 5 problems (0 errors, 5 warnings)

```

### Web build, exécuté après lint avec &&

Commande : `cd web && npm run build`

```text

> web@0.1.0 build
> next build

▲ Next.js 16.3.4 (Turbopack)
- Environments: .env.local
✓ Running next.config.ts took 305ms

  Creating an optimized production build ...
✓ Compiled successfully in 23.8s
  Running TypeScript ...
  Finished TypeScript in 11.3s ...
  Collecting page data using 1 worker ...
  Generating static pages using 1 worker (0/23) ...
  Generating static pages using 1 worker (5/23) 
  Generating static pages using 1 worker (11/23) 
  Generating static pages using 1 worker (17/23) 
✓ Generating static pages using 1 worker (23/23) in 1087ms
  Finalizing page optimization ...

Route (app)
┌ ○ /_not-found
├   /[locale]
│ ├ ● /fr
│ └ ● /en
├ ƒ /[locale]/app
├ ƒ /[locale]/app/appareils
├ ƒ /[locale]/app/bibliotheque
├ ƒ /[locale]/app/gateways
├ ƒ /[locale]/app/livraisons
├ ƒ /[locale]/app/reglages
├ ƒ /[locale]/app/sources
├   /[locale]/docs
│ ├ ● /fr/docs
│ └ ● /en/docs
├ ƒ /[locale]/sign-in/[[...sign-in]]
├ ƒ /[locale]/sign-up/[[...sign-up]]
├ ○ /apple-icon.png
└ ○ /icon.svg


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand

```

### Web test:library

Commande : `cd web && npm run test:library`

```text

> web@0.1.0 test:library
> node --experimental-strip-types --test components/app/library/library-collection.test.ts

TAP version 13
# (node:3822907) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///mnt/HC_Volume_106803131/projects/ferry-agent/web/components/app/library/library-collection.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /mnt/HC_Volume_106803131/projects/ferry-agent/web/package.json.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: mergeLibraryFetch
    # Subtest: marks unavailable when the first page fails (not an empty library)
    ok 1 - marks unavailable when the first page fails (not an empty library)
      ---
      duration_ms: 2.175528
      type: 'test'
      ...
    # Subtest: keeps first-page items and flags partial when page 2 fails
    ok 2 - keeps first-page items and flags partial when page 2 fails
      ---
      duration_ms: 0.428024
      type: 'test'
      ...
    # Subtest: returns a complete collection when all pages succeed
    ok 3 - returns a complete collection when all pages succeed
      ---
      duration_ms: 0.526178
      type: 'test'
      ...
    # Subtest: does not treat a partial collection as artificially complete
    ok 4 - does not treat a partial collection as artificially complete
      ---
      duration_ms: 0.22306
      type: 'test'
      ...
    1..4
ok 1 - mergeLibraryFetch
  ---
  duration_ms: 6.361796
  type: 'suite'
  ...
# Subtest: filterAndSortLibraryItems
    # Subtest: preserves the full set identity when filters match nothing
    ok 1 - preserves the full set identity when filters match nothing
      ---
      duration_ms: 0.302438
      type: 'test'
      ...
    # Subtest: sorts by title without inventing items
    ok 2 - sorts by title without inventing items
      ---
      duration_ms: 10.427218
      type: 'test'
      ...
    # Subtest: filters by title and author text without inventing items
    ok 3 - filters by title and author text without inventing items
      ---
      duration_ms: 0.423327
      type: 'test'
      ...
    1..3
ok 2 - filterAndSortLibraryItems
  ---
  duration_ms: 11.571258
  type: 'suite'
  ...
# Subtest: paginateLibraryItems
    # Subtest: clamps page into a bounded range
    ok 1 - clamps page into a bounded range
      ---
      duration_ms: 0.442803
      type: 'test'
      ...
    # Subtest: keeps an empty list on page 1 with a zero range
    ok 2 - keeps an empty list on page 1 with a zero range
      ---
      duration_ms: 0.267944
      type: 'test'
      ...
    1..2
ok 3 - paginateLibraryItems
  ---
  duration_ms: 0.991263
  type: 'suite'
  ...
# Subtest: pageAfterLibraryCriteriaChange
    # Subtest: resets to page 1 when filters change via the helper
    ok 1 - resets to page 1 when filters change via the helper
      ---
      duration_ms: 0.213781
      type: 'test'
      ...
    1..1
ok 4 - pageAfterLibraryCriteriaChange
  ---
  duration_ms: 0.317527
  type: 'suite'
  ...
# Subtest: libraryCollectionPageState
    # Subtest: resets an active filter change back to page 1 (not the stale page)
    ok 1 - resets an active filter change back to page 1 (not the stale page)
      ---
      duration_ms: 0.254207
      type: 'test'
      ...
    # Subtest: keeps the current page when criteria are unchanged
    ok 2 - keeps the current page when criteria are unchanged
      ---
      duration_ms: 0.145254
      type: 'test'
      ...
    1..2
ok 5 - libraryCollectionPageState
  ---
  duration_ms: 0.603674
  type: 'suite'
  ...
# Subtest: applyLibraryItemsRefreshResult
    # Subtest: keeps previous items when a refresh fails (not an empty library)
    ok 1 - keeps previous items when a refresh fails (not an empty library)
      ---
      duration_ms: 0.215465
      type: 'test'
      ...
    # Subtest: replaces items when a refresh succeeds
    ok 2 - replaces items when a refresh succeeds
      ---
      duration_ms: 0.147687
      type: 'test'
      ...
    1..2
ok 6 - applyLibraryItemsRefreshResult
  ---
  duration_ms: 0.490462
  type: 'suite'
  ...
# Subtest: buildCollectionHighlights
    # Subtest: exposes only reliable derived counts
    ok 1 - exposes only reliable derived counts
      ---
      duration_ms: 0.331443
      type: 'test'
      ...
    1..1
ok 7 - buildCollectionHighlights
  ---
  duration_ms: 0.419107
  type: 'suite'
  ...
# Subtest: hasActiveLibraryFilters
    # Subtest: detects text and select filters
    ok 1 - detects text and select filters
      ---
      duration_ms: 0.192802
      type: 'test'
      ...
    1..1
ok 8 - hasActiveLibraryFilters
  ---
  duration_ms: 0.280888
  type: 'suite'
  ...
# Subtest: recentLibraryItems
    # Subtest: returns the most recently added books without inventing titles
    ok 1 - returns the most recently added books without inventing titles
      ---
      duration_ms: 0.21368
      type: 'test'
      ...
    1..1
ok 9 - recentLibraryItems
  ---
  duration_ms: 0.300677
  type: 'suite'
  ...
1..9
# tests 17
# suites 9
# pass 17
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 220.828934
```

### Web test:delivery-devices

Commande : `cd web && npm run test:delivery-devices`

```text

> web@0.1.0 test:delivery-devices
> node --experimental-strip-types --test components/app/deliveries/deliveries-state.test.ts components/app/devices/devices-state.test.ts

TAP version 13
# (node:3831019) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///mnt/HC_Volume_106803131/projects/ferry-agent/web/components/app/deliveries/deliveries-state.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /mnt/HC_Volume_106803131/projects/ferry-agent/web/package.json.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: normalizeDeliveryStatus
    # Subtest: keeps known statuses and marks others as unknown
    ok 1 - keeps known statuses and marks others as unknown
      ---
      duration_ms: 0.887227
      type: 'test'
      ...
    # Subtest: never maps an unrecognized status to delivered (success)
    ok 2 - never maps an unrecognized status to delivered (success)
      ---
      duration_ms: 0.259918
      type: 'test'
      ...
    1..2
ok 1 - normalizeDeliveryStatus
  ---
  duration_ms: 2.138337
  type: 'suite'
  ...
# Subtest: active vs terminal
    # Subtest: uses API semantics: email sent is terminal, cloud sent remains active
    ok 1 - uses API semantics: email sent is terminal, cloud sent remains active
      ---
      duration_ms: 0.27139
      type: 'test'
      ...
    # Subtest: detects active rows for bounded polling
    ok 2 - detects active rows for bounded polling
      ---
      duration_ms: 0.18169
      type: 'test'
      ...
    1..2
ok 2 - active vs terminal
  ---
  duration_ms: 0.779185
  type: 'suite'
  ...
# Subtest: mergeDeliveryJobs
    # Subtest: updates status from fresh list while keeping prior title enrichment
    ok 1 - updates status from fresh list while keeping prior title enrichment
      ---
      duration_ms: 0.295786
      type: 'test'
      ...
    1..1
ok 3 - mergeDeliveryJobs
  ---
  duration_ms: 0.435568
  type: 'suite'
  ...
# Subtest: applyDeliveryFetchResult
    # Subtest: keeps previous items when refresh fails (not an empty list)
    ok 1 - keeps previous items when refresh fails (not an empty list)
      ---
      duration_ms: 0.55854
      type: 'test'
      ...
    # Subtest: replaces with merged fresh list on success
    ok 2 - replaces with merged fresh list on success
      ---
      duration_ms: 0.232006
      type: 'test'
      ...
    1..2
ok 4 - applyDeliveryFetchResult
  ---
  duration_ms: 2.236873
  type: 'suite'
  ...
# Subtest: terminal semantics after refresh
    # Subtest: does not retain stale terminal semantics when a response omits them
    ok 1 - does not retain stale terminal semantics when a response omits them
      ---
      duration_ms: 0.174688
      type: 'test'
      ...
    1..1
ok 5 - terminal semantics after refresh
  ---
  duration_ms: 0.279455
  type: 'suite'
  ...
# Subtest: keeps an empty unknown status visible after a formerly terminal job
ok 6 - keeps an empty unknown status visible after a formerly terminal job
  ---
  duration_ms: 0.309421
  type: 'test'
  ...
# (node:3831043) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///mnt/HC_Volume_106803131/projects/ferry-agent/web/components/app/devices/devices-state.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /mnt/HC_Volume_106803131/projects/ferry-agent/web/package.json.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: deviceDisplayName
    # Subtest: prefers the custom name when present
    ok 1 - prefers the custom name when present
      ---
      duration_ms: 0.736334
      type: 'test'
      ...
    # Subtest: falls back to brand and model, then brand alone
    ok 2 - falls back to brand and model, then brand alone
      ---
      duration_ms: 0.270378
      type: 'test'
      ...
    1..2
ok 7 - deviceDisplayName
  ---
  duration_ms: 2.025465
  type: 'suite'
  ...
# Subtest: buildDeviceEmailPayload
    # Subtest: trims a filled address and maps blank input to null
    ok 1 - trims a filled address and maps blank input to null
      ---
      duration_ms: 0.216147
      type: 'test'
      ...
    1..1
ok 8 - buildDeviceEmailPayload
  ---
  duration_ms: 0.381276
  type: 'suite'
  ...
# Subtest: isKindleDeliveryBrand
    # Subtest: is true only for the kindle brand
    ok 1 - is true only for the kindle brand
      ---
      duration_ms: 0.197019
      type: 'test'
      ...
    1..1
ok 9 - isKindleDeliveryBrand
  ---
  duration_ms: 0.384313
  type: 'suite'
  ...
# Subtest: applyDeviceFetchResult
    # Subtest: keeps previous devices when refresh fails (not an empty list)
    ok 1 - keeps previous devices when refresh fails (not an empty list)
      ---
      duration_ms: 0.577886
      type: 'test'
      ...
    # Subtest: uses the fresh list on success
    ok 2 - uses the fresh list on success
      ---
      duration_ms: 0.68648
      type: 'test'
      ...
    1..2
ok 10 - applyDeviceFetchResult
  ---
  duration_ms: 1.593304
  type: 'suite'
  ...
# Subtest: cloudLinkPresentation
    # Subtest: distinguishes linked from not linked without inventing a provider
    ok 1 - distinguishes linked from not linked without inventing a provider
      ---
      duration_ms: 1.169156
      type: 'test'
      ...
    # Subtest: treats an OAuth error as error, never linked/success
    ok 2 - treats an OAuth error as error, never linked/success
      ---
      duration_ms: 0.199484
      type: 'test'
      ...
    1..2
ok 11 - cloudLinkPresentation
  ---
  duration_ms: 1.638578
  type: 'suite'
  ...
1..11
# tests 17
# suites 10
# pass 17
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 318.956648
```

### Web test:gateways

Commande : `cd web && npm run test:gateways`

```text

> web@0.1.0 test:gateways
> node --experimental-strip-types --test components/app/gateways/gateways-state.test.ts

TAP version 13
# (node:3823135) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///mnt/HC_Volume_106803131/projects/ferry-agent/web/components/app/gateways/gateways-state.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /mnt/HC_Volume_106803131/projects/ferry-agent/web/package.json.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: minutesUntil / pairing expiry
    # Subtest: detects expired pairing codes for pending gateways only
    ok 1 - detects expired pairing codes for pending gateways only
      ---
      duration_ms: 5.017149
      type: 'test'
      ...
    # Subtest: expired pairing is never presented as connected/online
    ok 2 - expired pairing is never presented as connected/online
      ---
      duration_ms: 0.647747
      type: 'test'
      ...
    1..2
ok 1 - minutesUntil / pairing expiry
  ---
  duration_ms: 12.302973
  type: 'suite'
  ...
# Subtest: online window / connection presentation
    # Subtest: marks paired gateways connected only inside the online window
    ok 1 - marks paired gateways connected only inside the online window
      ---
      duration_ms: 0.936009
      type: 'test'
      ...
    # Subtest: absent or cold heartbeat is offline, never connected
    ok 2 - absent or cold heartbeat is offline, never connected
      ---
      duration_ms: 0.237277
      type: 'test'
      ...
    # Subtest: maps pending/expired/revoked without inventing connected
    ok 3 - maps pending/expired/revoked without inventing connected
      ---
      duration_ms: 0.257244
      type: 'test'
      ...
    1..3
ok 2 - online window / connection presentation
  ---
  duration_ms: 2.863382
  type: 'suite'
  ...
# Subtest: normalizeJobStatus
    # Subtest: keeps known statuses and marks others as uncertain (not done)
    ok 1 - keeps known statuses and marks others as uncertain (not done)
      ---
      duration_ms: 0.364465
      type: 'test'
      ...
    1..1
ok 3 - normalizeJobStatus
  ---
  duration_ms: 1.295296
  type: 'suite'
  ...
# Subtest: applyActivityFetchResult
    # Subtest: distinguishes empty activity from unavailable (failed fetch)
    ok 1 - distinguishes empty activity from unavailable (failed fetch)
      ---
      duration_ms: 7.438871
      type: 'test'
      ...
    1..1
ok 4 - applyActivityFetchResult
  ---
  duration_ms: 7.657142
  type: 'suite'
  ...
# Subtest: applyGatewayListFetchResult
    # Subtest: keeps previous gateways when refresh fails (not an empty list)
    ok 1 - keeps previous gateways when refresh fails (not an empty list)
      ---
      duration_ms: 0.221757
      type: 'test'
      ...
    # Subtest: replaces with fresh list on success
    ok 2 - replaces with fresh list on success
      ---
      duration_ms: 0.301747
      type: 'test'
      ...
    1..2
ok 5 - applyGatewayListFetchResult
  ---
  duration_ms: 0.840289
  type: 'suite'
  ...
# Subtest: copyTextToClipboard
    # Subtest: returns true only after a successful write
    ok 1 - returns true only after a successful write
      ---
      duration_ms: 0.576013
      type: 'test'
      ...
    # Subtest: returns false when the clipboard write rejects (no false success)
    ok 2 - returns false when the clipboard write rejects (no false success)
      ---
      duration_ms: 0.594767
      type: 'test'
      ...
    1..2
ok 6 - copyTextToClipboard
  ---
  duration_ms: 1.303772
  type: 'suite'
  ...
1..6
# tests 11
# suites 6
# pass 11
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 437.808472
```

### Web test:sources-settings

Commande : `cd web && npm run test:sources-settings`

```text

> web@0.1.0 test:sources-settings
> node --experimental-strip-types --test components/app/sources/sources-state.test.ts components/app/settings/settings-state.test.ts

TAP version 13
# (node:3823238) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///mnt/HC_Volume_106803131/projects/ferry-agent/web/components/app/settings/settings-state.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /mnt/HC_Volume_106803131/projects/ferry-agent/web/package.json.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: settingsAreDirty
    # Subtest: ignores equivalent trimmed Kindle emails and format
    ok 1 - ignores equivalent trimmed Kindle emails and format
      ---
      duration_ms: 0.927083
      type: 'test'
      ...
    # Subtest: flags changes to Kindle email or default format
    ok 2 - flags changes to Kindle email or default format
      ---
      duration_ms: 0.167876
      type: 'test'
      ...
    1..2
ok 1 - settingsAreDirty
  ---
  duration_ms: 2.542188
  type: 'suite'
  ...
# Subtest: buildSettingsPatchPayload
    # Subtest: sends null when Kindle email is cleared
    ok 1 - sends null when Kindle email is cleared
      ---
      duration_ms: 0.925439
      type: 'test'
      ...
    1..1
ok 2 - buildSettingsPatchPayload
  ---
  duration_ms: 1.060083
  type: 'suite'
  ...
# Subtest: formatTokenLastUsed
    # Subtest: returns never label for empty or invalid dates
    ok 1 - returns never label for empty or invalid dates
      ---
      duration_ms: 0.260028
      type: 'test'
      ...
    # Subtest: formats with the app locale, not a hard-coded browser default
    ok 2 - formats with the app locale, not a hard-coded browser default
      ---
      duration_ms: 50.704828
      type: 'test'
      ...
    1..2
ok 3 - formatTokenLastUsed
  ---
  duration_ms: 51.194768
  type: 'suite'
  ...
# Subtest: formatTokenCreatedDate
    # Subtest: formats a calendar date for OPDS row meta
    ok 1 - formats a calendar date for OPDS row meta
      ---
      duration_ms: 0.626057
      type: 'test'
      ...
    1..1
ok 4 - formatTokenCreatedDate
  ---
  duration_ms: 0.965765
  type: 'suite'
  ...
# Subtest: resolveQrRenderState
    # Subtest: distinguishes loading, ready, and error without collapsing error into loading
    ok 1 - distinguishes loading, ready, and error without collapsing error into loading
      ---
      duration_ms: 0.17034
      type: 'test'
      ...
    1..1
ok 5 - resolveQrRenderState
  ---
  duration_ms: 1.81909
  type: 'suite'
  ...
# Subtest: applyTokenListFetchResult
    # Subtest: keeps previous tokens when a refresh fails
    ok 1 - keeps previous tokens when a refresh fails
      ---
      duration_ms: 0.87795
      type: 'test'
      ...
    1..1
ok 6 - applyTokenListFetchResult
  ---
  duration_ms: 1.133561
  type: 'suite'
  ...
# (node:3823249) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///mnt/HC_Volume_106803131/projects/ferry-agent/web/components/app/sources/sources-state.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /mnt/HC_Volume_106803131/projects/ferry-agent/web/package.json.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: sourceRowKind / sourceGroup / display order
    # Subtest: splits open-access toggles from local upload and gateway rows
    ok 1 - splits open-access toggles from local upload and gateway rows
      ---
      duration_ms: 1.588815
      type: 'test'
      ...
    # Subtest: maps configure href only for real local destinations
    ok 2 - maps configure href only for real local destinations
      ---
      duration_ms: 0.239179
      type: 'test'
      ...
    # Subtest: never claims gateway connected without a connected presentation
    ok 3 - never claims gateway connected without a connected presentation
      ---
      duration_ms: 0.203682
      type: 'test'
      ...
    1..3
ok 7 - sourceRowKind / sourceGroup / display order
  ---
  duration_ms: 3.977546
  type: 'suite'
  ...
# Subtest: sourceAvailability (T10)
    # Subtest: marks activable sources enabled/disabled only when present in the payload
    ok 1 - marks activable sources enabled/disabled only when present in the payload
      ---
      duration_ms: 0.279996
      type: 'test'
      ...
    # Subtest: does not invent enabled when a toggleable type is absent
    ok 2 - does not invent enabled when a toggleable type is absent
      ---
      duration_ms: 0.154731
      type: 'test'
      ...
    # Subtest: marks all toggleable rows unknown when the list fetch failed
    ok 3 - marks all toggleable rows unknown when the list fetch failed
      ---
      duration_ms: 0.134724
      type: 'test'
      ...
    # Subtest: keeps upload always-on and gateway as local-module without claiming connected
    ok 4 - keeps upload always-on and gateway as local-module without claiming connected
      ---
      duration_ms: 0.271421
      type: 'test'
      ...
    1..4
ok 8 - sourceAvailability (T10)
  ---
  duration_ms: 1.348295
  type: 'suite'
  ...
# Subtest: canToggleSource
    # Subtest: allows toggles only for known activable rows when the list is available
    ok 1 - allows toggles only for known activable rows when the list is available
      ---
      duration_ms: 0.514247
      type: 'test'
      ...
    1..1
ok 9 - canToggleSource
  ---
  duration_ms: 2.156803
  type: 'suite'
  ...
# Subtest: sourcesSurfaceState / hasPartialSources
    # Subtest: keeps unavailable, empty, partial, error and success distinct
    ok 1 - keeps unavailable, empty, partial, error and success distinct
      ---
      duration_ms: 0.337744
      type: 'test'
      ...
    1..1
ok 10 - sourcesSurfaceState / hasPartialSources
  ---
  duration_ms: 0.545285
  type: 'suite'
  ...
# Subtest: toggle apply helpers
    # Subtest: replaces the patched source on success and preserves siblings
    ok 1 - replaces the patched source on success and preserves siblings
      ---
      duration_ms: 0.371158
      type: 'test'
      ...
    # Subtest: keeps the previous list on failure (no false enabled state)
    ok 2 - keeps the previous list on failure (no false enabled state)
      ---
      duration_ms: 0.139492
      type: 'test'
      ...
    1..2
ok 11 - toggle apply helpers
  ---
  duration_ms: 0.643961
  type: 'suite'
  ...
1..11
# tests 19
# suites 11
# pass 19
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 449.670836
```

### Web test:final

Commande : `cd web && npm run test:final`

```text

> web@0.1.0 test:final
> node --experimental-strip-types --test lib/gateway-job-state.test.ts

TAP version 13
# (node:3823319) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///mnt/HC_Volume_106803131/projects/ferry-agent/web/lib/gateway-job-state.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /mnt/HC_Volume_106803131/projects/ferry-agent/web/package.json.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: resolveGatewayJobView
    # Subtest: returns a cleared view when jobId is null (not the previous snapshot)
    ok 1 - returns a cleared view when jobId is null (not the previous snapshot)
      ---
      duration_ms: 1.545334
      type: 'test'
      ...
    # Subtest: ignores a snapshot that belongs to another jobId
    ok 2 - ignores a snapshot that belongs to another jobId
      ---
      duration_ms: 0.152738
      type: 'test'
      ...
    # Subtest: exposes the snapshot only when jobIds match
    ok 3 - exposes the snapshot only when jobIds match
      ---
      duration_ms: 0.163897
      type: 'test'
      ...
    1..3
ok 1 - resolveGatewayJobView
  ---
  duration_ms: 2.902986
  type: 'suite'
  ...
1..1
# tests 3
# suites 1
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 151.890664
```

### Web test:product-truth

Commande : `cd web && npm run test:product-truth`

```text

> web@0.1.0 test:product-truth
> node --experimental-strip-types --test lib/gateway-image.test.ts lib/product-truth.test.ts

TAP version 13
# (node:3823345) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///mnt/HC_Volume_106803131/projects/ferry-agent/web/lib/gateway-image.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /mnt/HC_Volume_106803131/projects/ferry-agent/web/package.json.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: gatewayImageUrl
    # Subtest: is the canonical /bundle ferry-agent-gateway-amd64.tar URL
    ok 1 - is the canonical /bundle ferry-agent-gateway-amd64.tar URL
      ---
      duration_ms: 0.70787
      type: 'test'
      ...
    # Subtest: is the canonical /bundle ferry-agent-gateway-arm64.tar URL
    ok 2 - is the canonical /bundle ferry-agent-gateway-arm64.tar URL
      ---
      duration_ms: 0.225844
      type: 'test'
      ...
    # Subtest: does not point at GitHub Releases or compressed assets
    ok 3 - does not point at GitHub Releases or compressed assets
      ---
      duration_ms: 0.172243
      type: 'test'
      ...
    1..3
ok 1 - gatewayImageUrl
  ---
  duration_ms: 2.026168
  type: 'suite'
  ...
# Subtest: gatewayImageFilename
    # Subtest: names the arm64 docker-format archive
    ok 1 - names the arm64 docker-format archive
      ---
      duration_ms: 0.240462
      type: 'test'
      ...
    1..1
ok 2 - gatewayImageFilename
  ---
  duration_ms: 0.371379
  type: 'suite'
  ...
# Subtest: GATEWAY_DEFAULT_ARCH
    # Subtest: is amd64 so SSR never emits a dead link
    ok 1 - is amd64 so SSR never emits a dead link
      ---
      duration_ms: 0.216447
      type: 'test'
      ...
    1..1
ok 3 - GATEWAY_DEFAULT_ARCH
  ---
  duration_ms: 0.329139
  type: 'suite'
  ...
# Subtest: detectGatewayArch
    # Subtest: uses Chromium architecture hint arm → arm64
    ok 1 - uses Chromium architecture hint arm → arm64
      ---
      duration_ms: 0.394562
      type: 'test'
      ...
    # Subtest: uses Chromium architecture hint x86 → amd64
    ok 2 - uses Chromium architecture hint x86 → amd64
      ---
      duration_ms: 0.266701
      type: 'test'
      ...
    # Subtest: detects Linux aarch64 from the user agent
    ok 3 - detects Linux aarch64 from the user agent
      ---
      duration_ms: 0.23943
      type: 'test'
      ...
    # Subtest: detects Windows x64 from the user agent
    ok 4 - detects Windows x64 from the user agent
      ---
      duration_ms: 0.388329
      type: 'test'
      ...
    # Subtest: detects Linux x86_64 from the user agent
    ok 5 - detects Linux x86_64 from the user agent
      ---
      duration_ms: 0.267612
      type: 'test'
      ...
    # Subtest: defaults Apple platforms to arm64 (frozen Intel UA)
    ok 6 - defaults Apple platforms to arm64 (frozen Intel UA)
      ---
      duration_ms: 0.119996
      type: 'test'
      ...
    # Subtest: lets architecture hint override the Apple Silicon default
    ok 7 - lets architecture hint override the Apple Silicon default
      ---
      duration_ms: 0.142939
      type: 'test'
      ...
    # Subtest: falls back to amd64 with empty signals
    ok 8 - falls back to amd64 with empty signals
      ---
      duration_ms: 0.087233
      type: 'test'
      ...
    1..8
ok 4 - detectGatewayArch
  ---
  duration_ms: 3.556604
  type: 'suite'
  ...
# (node:3823352) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///mnt/HC_Volume_106803131/projects/ferry-agent/web/lib/product-truth.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /mnt/HC_Volume_106803131/projects/ferry-agent/web/package.json.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: product truth in marketing i18n
    # Subtest: French messages do not promise a local-only library
    ok 1 - French messages do not promise a local-only library
      ---
      duration_ms: 1.278323
      type: 'test'
      ...
    # Subtest: English messages do not promise a local-only library
    ok 2 - English messages do not promise a local-only library
      ---
      duration_ms: 1.572246
      type: 'test'
      ...
    # Subtest: both locales state that the library is online / hosted
    ok 3 - both locales state that the library is online / hosted
      ---
      duration_ms: 2.133229
      type: 'test'
      ...
    # Subtest: landing hero presents an online library and a coming-soon demo, not a confirmed delivery
    ok 4 - landing hero presents an online library and a coming-soon demo, not a confirmed delivery
      ---
      duration_ms: 1.94174
      type: 'test'
      ...
    1..4
ok 5 - product truth in marketing i18n
  ---
  duration_ms: 8.037686
  type: 'suite'
  ...
1..5
# tests 17
# suites 5
# pass 17
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 310.964931
```

### Web test:ui-harness

Commande : `cd web && npm run test:ui-harness`

```text

> web@0.1.0 test:ui-harness
> vitest run --config vitest.config.mts


 RUN  v4.1.11 /mnt/HC_Volume_106803131/projects/ferry-agent/web


 Test Files  32 passed (32)
      Tests  126 passed (126)
   Start at  17:52:40
   Duration  69.19s (transform 4.58s, setup 8.49s, import 21.41s, tests 13.68s, environment 18.40s)

```

### Parité des traductions

Commande : `cd web && npm run check:i18n`

```text

> web@0.1.0 check:i18n
> node ./scripts/check-i18n-keys.mjs

i18n keys OK (900 keys in fr.json and en.json)
```

### Types API, comparaison des empreintes avant/après régénération

Commande : `bash scripts/gen-api-types.sh`

```text
✨ openapi-typescript 7.13.0
🚀 /home/glados/projects/ferry-agent/openapi.json → /home/glados/projects/ferry-agent/web/lib/api-types.generated.ts [1.1s]
OpenAPI et types TypeScript identiques après régénération.
```

### Politique CI

Commande : `./.venv/bin/python -m pytest .github/tests/test_ci_pr_gates_policy.py -q`

```text
.........................................                                [100%]
41 passed in 0.34s
```

### Ruff bloquant

Commande : `./.venv/bin/ruff check . --select TD002,TD003`

```text
All checks passed!
```

### Ruff sur les nouveaux fichiers Python

Commande : `./.venv/bin/ruff check src/ferry_agent/services/book_metadata.py tests/test_delivery_truth.py gateway/agent/tests/test_image_credentials.py`

```text
All checks passed!
```

### Syntaxe de l’installeur

Commande : `bash -n gateway/dist/install.sh`

Sortie stdout/stderr vide ; code de retour 0.

### Syntaxe du démarrage gateway

Commande : `bash -n gateway/image/entrypoint.sh`

Sortie stdout/stderr vide ; code de retour 0.

### Compose, copie dans un dossier temporaire et secrets factices

Commande : `docker compose -f gateway/dist/compose.yaml config --images`

```text
ghcr.io/aperture-science-technology/ferry-agent/gateway:latest
```

### Substitution effective des variables, contrôlée par assertions sur config --format json

Commande : `docker compose -f gateway/dist/compose.yaml config --format json`

```text
Substitution réelle vérifiée : deux secrets factices, valeurs Prowlarr vides par défaut et valeurs explicites conservées.
```

Les 77 sauts du lancement plateforme incluent les tests nécessitant Postgres et les sauts déjà prévus par les suites. Le lancement séparé sur Postgres exécute les 76 tests d’intégration avec succès. Le conteneur jetable a été arrêté et supprimé ; aucune base existante n’a été utilisée.

Audits supplémentaires identiques aux étapes non bloquantes du workflow :

- `ruff check . --exit-zero` : code 0 par configuration, **705 erreurs signalées** ; ce n’est pas un audit Ruff intégral sans anomalie.
- `ruff format --check .` : code 1, **83 fichiers à reformater, 129 déjà formatés** ; étape déclarée non bloquante dans la CI.
- Ces sorties intégrales sont dans les sections `21-ruff-all-final.txt` et `22-format-all-final.txt` du journal brut. Les anomalies hors périmètre n’ont pas fait l’objet d’une réécriture globale.

## 3. Tests ajoutés, modifiés ou inversés et raisons

- Avant la correction, la nouvelle suite ciblée a réellement été lancée : **26 échecs**. Elle vérifiait le nom public, le sujet et l’idempotence ainsi que les vingt combinaisons méthode/statut. La sortie intégrale figure dans `00-regressions-before.txt` du journal brut.
- `test_delivery_tier_a.py` : trois attentes `book.epub`/`book.pdf` deviennent `Herbert - Dune.epub`/`.pdf`, car le nom du fichier de stockage ne doit plus être envoyé. Les contrôles de format, statut `sent` et absence de preuve Kindle restent présents.
- `test_cloud_links.py` : trois attentes de nom remplacées, y compris celle de la doublure d’upload ; les assertions sur le contenu, la conversion et `delivered` restent présentes.
- Les doublures mailer de `test_delivery_tier_a.py` et `test_conversion_profiles.py` acceptent le nouveau paramètre optionnel `title` ; aucune assertion retirée.
- `deliveries-state.test.ts` : l’assertion globale « sent est actif » devient deux cas explicites, email terminal et cloud actif. Les anciens cas queued/delivered/failed sont conservés avec la sémantique de l’API. Des assertions supplémentaires protègent les statuts inconnus, y compris une chaîne vide après rafraîchissement.
- `deliveries-pen-rebuild.render.test.tsx` : les libellés email « En cours » / « In progress » deviennent « Envoyé — accepté par le relais » / traduction anglaise ; le scénario comportant un email accepté et un queued passe de deux actifs à un, et le filtre exclut explicitement cet email.
- `deliveries-list.render.test.tsx` : fixtures complétées par `terminal` ; assertions conservées.
- `docs-guide-polish.render.test.tsx` : six blocs de commande deviennent sept, car la commande de lecture des identifiants est ajoutée ; nouvelles assertions sur son contenu exact et les chapitres FR/EN.
- Les nouveaux tests EPUB utilisent un ZIP avec container.xml, OPF, chapitre XHTML et vraie image PNG ; ils vérifient la couverture EPUB 2/3, la conservation des champs renseignés, le repli release, les fichiers défectueux, les pages explicites et la persistance Postgres.
- Deux PDF réels, avec et sans métadonnées, vérifient le titre, l’auteur, les deux pages et l’absence de données inventées ; les champs déjà renseignés restent intacts.
- Aucun harnais shell existant n’a été trouvé. Les tests Python exécutent directement les définitions réelles d’entrypoint.sh avec `/bin/sh`, dans un dossier temporaire, sans lancer les étapes privilégiées de démarrage ; ils lisent ensuite le fichier avec le vrai lecteur Forms. Le shell est donc testé, et non remplacé par une réimplémentation Python.
- Les nouveaux tests UI vérifient l’adresse issue de l’API dans le détail et le retour d’envoi, les erreurs 401/500, l’absence de lecture mail pour le cloud et les compteurs/filtres.
- Les deux échecs initiaux MCP provenaient de FastMCP 3.4.7 installé alors que le dépôt exige 4.0.10. Installation de la version déjà déclarée dans le même environnement local : **103 tests réussis sans modifier un test MCP**. Le build web initial avait aussi échoué sur `@clerk/localizations`, déjà déclaré mais absent ; `npm ci --ignore-scripts` a réinstallé le verrouillage existant, sans modifier package.json ni package-lock.json.

## 4. Ce qui n’a pas été fait, et pourquoi

- Aucune CI distante déclenchée ni observée verte pour ces fichiers non publiés. La condition distante de done reste à faire constater par GLaDOS ; aucun commit, tag ou push n’a été effectué.
- Aucun envoi réel à Amazon, aucun upload vers un compte cloud réel, aucune vérification sur une liseuse physique ni installation complète du Gateway sur un poste utilisateur : absence de compte/appareil de validation fourni. Les canaux sont couverts par les tests de comportement, l’import est validé sur Postgres et les fonctions shell et substitutions sont exécutées réellement.
- Aucune invention de métadonnées PDF : seuls titre/auteur explicites et nombre réel de pages sont lus avec PyMuPDF, déjà déclaré et installé ; éditeur, date de publication, ISBN et couverture PDF restent vides sans information fiable. Les couvertures EPUB PNG/JPEG sont prises en charge ; SVG n’est pas servi depuis l’archive.
- Aucun rattrapage automatique de la bibliothèque existante : enrichissement lors des nouveaux imports, sans réécrire les valeurs déjà enregistrées.
- Aucun scan de l’historique ni publication des images/assets : hors du travail local autorisé et incompatible avec l’interdiction des commandes git pour les étapes qui en nécessitent.
- Les audits Ruff généraux restent non vierges ; ils sont informatifs dans le workflow existant. Le contrôle TD002/TD003 obligatoire passe ; aucune suppression d’assertion ni désactivation de contrôle n’a été utilisée.
- **Les changements de gateway/dist/install.sh et compose.yaml restent dormants sous `/bundle` jusqu’à une nouvelle Release GitHub `v*`.** L’ordre voulu dans deploy/deploy.sh n’a pas été modifié : copie locale puis remplacement par les assets de la Release correspondant à l’image.

## 5. Décisions prises

- Nom public déterministe `Auteur - Titre.ext`, borne de 120 caractères, titre seul sans auteur et repli neutre `Document.ext`.
- Les noms de release sont des replis uniquement à la création ; un titre déjà enregistré reste inchangé, même s’il ressemble à une release.
- Extraction EPUB par la bibliothèque standard, lectures XML bornées à 1 Mio et couverture à 2 Mio ; réutilisation du parseur PyMuPDF déjà déclaré pour les PDF, sans ajout de dépendance.
- Couvertures PNG/JPEG conservées à côté du livre et référencées par l’URL API de l’item, afin de rester disponibles indépendamment du cache temporaire.
- Pages EPUB uniquement à partir d’une étendue dcterms:extent explicitement exprimée en pages ; pages PDF comptées par PyMuPDF déjà présent. Aucune date de création PDF interprétée comme date de publication.
- Champ `terminal` calculé à la sérialisation, sans changement SQL ; les inconnus et les réponses sans sémantique terminale ne sont jamais traités comme terminés par le web.
- Rappel Amazon commun aux deux surfaces, présent aussi avant l’envoi, avec adresse masquée si la lecture des réglages échoue.
- Variables Prowlarr explicites prioritaires sur le fichier ; sans variables, conservation du fichier, puis génération au premier démarrage ; valeurs avec saut de ligne refusées car le fichier est un format par lignes.
- Réalignement des environnements locaux sur les dépendances déjà déclarées, sans ajout de dépendance applicative.
- Ces choix sont consignés dans l’ADR 0014.
