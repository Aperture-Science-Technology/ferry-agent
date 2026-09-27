# ADR 0010 — Envoi email Resend / Send-to-Kindle

- **Statut** : accepté
- **Date** : 2026-09-27
- **Ticket** : FA-MAIL-SMTP-01

## Contexte

La livraison tier A envoie un ebook à l'adresse Send-to-Kindle de l'utilisateur
via SMTP. En production, un mauvais modèle de configuration (relais Gmail
recommandé alors que la plateforme utilise Resend) a déjà conduit à une config
inutilisable. Les domaines grand public appliquent une politique DMARC stricte :
envoyer « au nom de » l'utilisateur échoue ou part en spam. Amazon, de son côté,
n'accepte plus les formats `mobi`/`azw3` (support retiré fin 2023) et n'envoie
aucun rebond si l'expéditeur n'est pas approuvé.

## Décision

1. **Relais Resend**, expéditeur unique sur un **sous-domaine que nous
   contrôlons** (ex. `no-reply@ferry-agent.aperture-agency.org`). On n'envoie
   jamais au nom de l'utilisateur : sans alignement SPF/DKIM sur notre domaine,
   les messages sont rejetés ou classés en spam.
2. Le domaine d'envoi doit être **vérifié chez le fournisseur** (SPF, DKIM, et
   DMARC publiés) avant tout envoi réel.
3. L'utilisateur doit **approuver l'adresse d'envoi chez Amazon** (liste des
   expéditeurs de documents personnels). Amazon ne renvoie **aucun rebond** :
   sans approbation, le document est abandonné en silence.
4. Pour un envoi email, l'état terminal est **`sent`** (« accepté par le
   relais »), **jamais `delivered`**. Aucun accusé de réception côté Kindle
   n'existe ; prétendre le contraire serait un mensonge produit.
5. **`mobi` / `azw3` ne sont plus des formats de livraison Kindle valides** ;
   la conversion vise EPUB (ou PDF) avant envoi.
6. **Liste blanche de domaines de destination** (politique produit définie dans
   le code, `src/ferry_agent/config.py`) et **quotas** surchargeables par
   l'environnement — horaire par utilisateur (`EMAIL_SEND_HOURLY_QUOTA`) +
   journalier global (`EMAIL_SEND_DAILY_QUOTA`), transmis par le compose : le
   relais appartient à la plateforme et l'offre est plafonnée pour **tout le
   compte**.
7. Adresse de destination : celle de l'**appareil** si renseignée, sinon celle
   du **profil**.

## Conséquences

- Opérateur : configurer Resend + domaine vérifié + variables SMTP (dont
  `SMTP_SECURITY` / `SMTP_REPLY_TO` transmises par le compose) ; documenter
  l'adresse à faire approuver chez Amazon.
- Produit : UI et API exposent `sent` comme « accepté par le relais », jamais
  « livré sur la Kindle ».
- Anti-abus : destinataires hors domaines Kindle refusés ; un utilisateur
  bavard ne peut pas épuiser seul le plafond journalier du compte.
- Formats legacy Kindle : conversion forcée vers un format encore accepté.

## Alternatives écartées

- **Relais grand public (Gmail) ou SES « au nom de » l'utilisateur** — DMARC
  des boîtes personnelles / grand public bloque ou spamifie ; on ne contrôle
  pas la réputation de ces domaines. Rejeté après une erreur réelle de
  configuration Gmail sur une plateforme Resend.
- **Envoi sans liste blanche de domaines** — le relais plateforme devient un
  canon à spam pour le compte entier (plafond partagé Resend).
- **Statut `delivered` dès l'acceptation SMTP** — mensonge : Amazon n'accuse
  pas réception ; hors webhook fournisseur (hors périmètre v1).
