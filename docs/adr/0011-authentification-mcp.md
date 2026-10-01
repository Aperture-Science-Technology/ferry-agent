# ADR 0011 — Authentification MCP (assertion d'identité + OAuth)

- **Statut** : accepté
- **Date** : 2026-10-01
- **Ticket** : FA-MCP-FULL-01 (lot 4)

> Numérotation : l'ADR 0004 est déjà pris (Calibre). Ce document est le suivant
> libre de la série ; la mission demandait « 0004-authentification-mcp ».

## Contexte

Le serveur MCP relayait le jeton Clerk amont au cœur (`Authorization: Bearer`
passthrough). Côté cœur, `CLERK_AUDIENCE` vide désactive `verify_aud` : tout
jeton signé par l'instance Clerk était accepté, sans audience dédiée. La
spécification MCP interdit ce motif « token passthrough + audience non
validée ».

Par ailleurs, l'état OAuth FastMCP (clients DCR/CIMD, jetons chiffrés, JTI)
vivait dans le conteneur sans volume : chaque redéploiement forçait une
réauthentification de tous les clients MCP.

## Décision

### Rôles

| Rôle | Acteur |
|------|--------|
| Client MCP | IDE / agent (Cursor, Claude…) |
| Resource server + AS proxy | `ferry-agent-mcp` (FastMCP `ClerkProvider`) |
| API métier | cœur FastAPI (`ferry-agent-core`) |

Le MCP reste un **wrapper mince** : pas de logique métier dupliquée. Après
validation OAuth de l'appelant, il **forge une assertion Ed25519 courte**
portant l'identité utilisateur (`sub` + `email` Clerk vérifiés) et la présente
au cœur. Pas de compte de service (ADR 0003 respecté).

### Contrat d'assertion

```
iss = "ferry-agent-mcp"
aud = "ferry-core"
sub = <sub Clerk vérifié>
email = <email Clerk vérifié>
iat = maintenant
exp = iat + 120 s   (refus si exp − iat > 300 s)
jti = aléatoire
```

Clés asymétriques : privée **uniquement** côté MCP
(`MCP_CORE_ASSERTION_PRIVATE_KEY_B64`), publique côté cœur
(`MCP_ASSERTION_PUBLIC_KEY_B64`), PEM encodé base64 une ligne. Absentes →
repli historique MCP (passthrough + warning) / voie assertion inactive côté
cœur (web inchangé).

### Pourquoi (trade-off)

Le MCP devient **émetteur de confiance** pour le cœur : compromettre le MCP
permet de forger une identité. En échange, le cœur n'accepte plus un jeton
Clerk « orphelin » d'audience, et compromettre le cœur seul ne permet pas de
forger (pas de clé privée). Audience distincte de la voie Clerk web.

### Conformité OAuth retenue

- PRM RFC 9728, `WWW-Authenticate`, PKCE S256, DCR déprécié + CIMD,
  consentement, introspection par requête (FastMCP `ClerkTokenVerifier`).
- Protocole MCP 2026-07-28 + double ère (SDK).
- `required_scopes` / `valid_scopes` = `openid email profile` → le challenge
  401 porte `scope="…"` (RFC 6750 §3) via `challenge_scopes` FastMCP 4.
- Volume nommé `ferry_mcp_oauth` → `/home/appuser/.local/share/fastmcp`.
- `MCP_JWT_SIGNING_KEY` dédiée (plus de dérivation exclusive du secret OAuth).
- `issuer_url` passé sans slash final ; Traefik couvre aussi
  `/.well-known/openid-configuration`.
- CORS Starlette (`CORSMiddleware`) via `run_http_async(middleware=…)` ;
  défaut `MCP_ALLOWED_ORIGINS=*` avec `allow_credentials=False` (liste fermée
  de clients MCP non tenable). Liste CSV → refuse Origin inconnue
  (`host_origin_protection=True`).

### Écarts résiduels connus

1. **`CLERK_AUDIENCE` vide côté web** — `verify_aud=False` pour les sessions
   navigateur. Hors périmètre de ce lot (voie Clerk volontairement inchangée).
2. **Slash final sur `issuer` publié** — malgré `issuer_url` sans slash,
   Pydantic `AnyHttpUrl` (FastMCP 4.0.10) normalise avec `/`. Les métadonnées
   `/.well-known/oauth-authorization-server` et le claim `iss` des JWT FastMCP
   peuvent donc porter le slash. Pas de monkey-patch ; à suivre côté FastMCP.
3. **CORS `*`** — pas de refus d'Origin quand l'opérateur laisse `*` ; la
   sécurité d'auth repose sur OAuth Bearer + Traefik `Host(…)`.

## Conséquences

- Opérateur : générer une paire Ed25519, renseigner privée (MCP) / publique
  (cœur), et une `MCP_JWT_SIGNING_KEY` stable.
- Clients MCP conservent leur état OAuth entre redéploiements.
- Tests : assertions valides / refus (aud, iss, signature, TTL, sub manquant)
  côté cœur ; forge / repli / email manquant côté MCP.

## Alternatives écartées

- **Compte service MCP** — déjà rejeté (ADR 0003).
- **Continuer le passthrough Clerk** — non conforme MCP (audience).
- **HMAC partagé cœur↔MCP** — compromettre le cœur exposerait la clé de forge.
- **Monkey-patch issuer / WWW-Authenticate** — fragile ; écart documenté à la
  place quand FastMCP ne l'expose pas proprement.
