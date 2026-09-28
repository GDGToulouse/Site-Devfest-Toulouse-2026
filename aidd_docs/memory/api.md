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
- Validation des entrées par les JSON Schemas de Fastify, déclarés sur chaque route ; helpers `notFound()` et validation d'id dans `src/backend/src/lib/admin-helpers.ts`
- Limite de débit par IP, deux budgets séparés : l'API et les fichiers uploadés (`src/backend/src/lib/rate-limit-options.ts`)
- Spec OpenAPI servie sur `/api/docs` ; référence de l'API publique : `docs/api-publique.md`
