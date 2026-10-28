# API

## Style

- REST sur Fastify, routes dans `src/backend/src/routes/`, enregistrées dans `src/backend/src/index.ts`
- Pas de versioning. Préfixes : `/api` (public), `/api/admin` (back-office), `/api/me` (compte connecté)

## Resources

- Éditions et programme, talks, speakers, replays, sponsors, articles, pages, catégories, réglages du site
- Calendrier (`.ics`), brochure sponsor, formulaire de contact
- Lien de modification speaker (`/edit`), invitation et espace sponsor
- Back-office : CRUD de tout ce qui précède, import, traduction, fichiers, corbeille, utilisateurs, clés API

## Contracts

- Erreurs en `{ error, message? }` (schéma `Error`), pagination via le schéma `Pagination`, tous deux dans `src/backend/src/schemas/common.ts`
- Les champs de texte riche passent par `sanitizeRichHtml` : une valeur **sans balise** est du texte et devient `<p>…</p>` avec `&`, `<`, `>` échappés une fois (#661) ; sans cela, une page qui affiche le texte brut échappait `&amp;` une seconde fois. `htmlToText` (frontend) décode les entités pour les meta
- Validation des entrées par les JSON Schemas de Fastify, déclarés sur chaque route ; helpers `notFound()` et validation d'id dans `src/backend/src/lib/admin-helpers.ts`
- Limite de débit par IP, budgets séparés : l'API, les fichiers uploadés, les écrans du jour J (`/api/arrivals`, 1 000/min : tout le lieu partage une adresse) et la connexion (60/min par IP, plus 10/min par IP **et** par compte nommé dans le corps) — `src/backend/src/lib/rate-limit-options.ts`. Deux budgets sur une même route : le second passe par `createRateLimit`, car le `rateLimit()` du plugin ignore une requête déjà comptée (#642)
- Formulaire de contact, catégorie brochure : 3 demandes par heure et par IP (mémoire), un envoi par heure et par adresse (base : `ContactMessage`), réponse identique à un succès au-delà (`lib/brochure-limits.ts`, #662) ; l'IP vient de `TRUST_PROXY_HOPS` (`architecture.md`)
- Spec OpenAPI servie sur `/api/docs` ; référence de l'API publique : `docs/api-publique.md`
