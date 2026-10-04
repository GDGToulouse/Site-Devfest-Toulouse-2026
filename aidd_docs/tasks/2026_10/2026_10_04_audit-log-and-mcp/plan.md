---
objective: "Chaque écriture du site est tracée (qui, quand, quoi, par quel canal) et consultable 13 mois, et un utilisateur peut brancher un agent MCP par OAuth qui agit avec ses droits exacts, en prod avant l'événement si l'audit des droits passe."
status: pending
---

# Plan: Historique des modifications (#513) et connecteur MCP OAuth (#514)

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Livrer #513 puis #514, sur `dev-j` d'abord, chacun vérifiable seul ; ouvrir le connecteur en prod seulement après l'audit des droits de l'API |
| **Source** | Issues #513 et #514 ; décisions de Julien du 2026-10-04 (démarrer sans attendre la mise en prod de la vague 1, rétention 13 mois, MCP en prod avant l'événement si l'audit passe) |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1 | #513 — table `AuditLog` et contexte de requête (acteur, canal) | [`phase-1.md`](./phase-1.md) |
| 2 | #513 — extension Prisma qui trace toute écriture | [`phase-2.md`](./phase-2.md) |
| 3 | #513 — écran Historique et historique par fiche, purge à 13 mois | [`phase-3.md`](./phase-3.md) |
| 4 | #514 — montée de better-auth 1.6.23 → 1.7.7, sans régression d'authentification | [`phase-4.md`](./phase-4.md) |
| 5 | #514 — serveur OAuth MCP (`@better-auth/mcp`, JWT, CIMD) et page de connexion des agents | [`phase-5.md`](./phase-5.md) |
| 6 | #514 — jeton OAuth accepté par l'API et serveur MCP `/api/mcp` | [`phase-6.md`](./phase-6.md) |
| 7 | #514 — agents connectés : liste et révocation par l'utilisateur | [`phase-7.md`](./phase-7.md) |
| 8 | #514 — audit des droits de l'API, condition d'ouverture en prod | [`phase-8.md`](./phase-8.md) |

Branches : `feature/us-513-audit-log` (phases 1-3), `chore/us-514-better-auth-1-7` (phase 4, mergée seule pour isoler le risque), `feature/us-514-mcp-connector` (phases 5-8). Ordre imposé : 1 → 2 → 3 ; 4 → 5 → 6 → 7 → 8 ; la phase 6 dépend de la 2 (canal `mcp`). La mise en prod de la vague 1 avance en parallèle, sans bloquer.

## Resources

| Source | Verified |
| ------ | -------- |
| https://registry.npmjs.org (2026-10-04) | `better-auth` 1.7.7, `@better-auth/mcp` 1.7.7, `@better-auth/cimd` 1.7.7, `@better-auth/oauth-provider` 1.7.7, `@modelcontextprotocol/server` 2.3.0 (SDK MCP v2) |
| https://raw.githubusercontent.com/better-auth/better-auth/main/docs/content/docs/plugins/mcp.mdx | `mcp()` est le fournisseur OAuth 2.1 (ne pas ajouter `oauthProvider()` en plus), exige le plugin `jwt()`, sert `/.well-known/oauth-protected-resource`, schéma `oauthClient`/`oauthAccessToken`/`oauthRefreshToken`/`oauthConsent`/`oauthClientAssertion` ; MCP déprécie le DCR au profit de CIMD, DCR seulement en repli explicite ; SDK MCP v2 en mode sans état |
| `node_modules/better-auth` 1.6.23 du conteneur | le plugin `mcp` installé est l'ancien, adossé à `oidc-provider` (`/mcp/register`, DCR) : non retenu, d'où la montée de version |

Context7 n'était pas disponible dans la session : la doc a été lue à la source, et chaque API est à revérifier dans les types installés au moment de coder.

## Decisions

| Decision | Why |
| -------- | --- |
| Traçage par une extension Prisma unique sur le client partagé, contexte porté par `AsyncLocalStorage` | Une route oubliée serait une modification invisible (#513) ; aucun contexte de requête n'existe aujourd'hui |
| Le connecteur appelle l'API existante en interne (`app.inject`) avec le jeton de l'utilisateur | Aucune règle d'accès dans le connecteur : l'API décide, les droits ne peuvent pas diverger (#514) |
| better-auth 1.7.7 + `@better-auth/mcp` plutôt que le plugin `mcp` de 1.6 | Le plugin 1.6 repose sur DCR, que MCP déprécie ; la pile 1.7 est celle que documente better-auth |
| Montée de better-auth isolée dans sa propre branche et sa propre PR | Elle touche toute l'authentification du site ; une régression doit pouvoir se défaire sans emporter le connecteur |
| Ouverture du connecteur en prod conditionnée par l'audit des droits (phase 8) | Un trou d'autorisation devient joignable par un agent (#500 en était un) ; décision de Julien |
