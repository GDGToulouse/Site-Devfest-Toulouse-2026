# CLAUDE.md

DevFest Toulouse 2026 — site remplaçant le WordPress (Avada) des éditions 2023-2025.
Objectif : un site durable, maintenable d'une édition à l'autre.

## Architecture

Deux applications indépendantes, **sous `src/`** :

- **`src/frontend/`** — Next.js 16 (App Router, Server Components), Tailwind v4, next-intl, pnpm
- **`src/backend/`** — API REST Fastify, Prisma 7, PostgreSQL

Le frontend appelle le backend en HTTP (`http://backend:4000` en Docker, via `BACKEND_URL`).
**Le backend seul possède Prisma et la base** ; le frontend n'accède jamais à la base directement.

Auth : better-auth (admin uniquement). Hébergement : VPS + Coolify. CI : GitHub Actions.

## Pièges de ce dépôt

Ce que le code ne dit pas, ou dit de façon trompeuse.

**Routes.** `src/frontend/src/app/admin/` est **hors** de `[locale]/` : le back-office est sur
`/admin`, **pas** `/fr/admin` (qui renvoie 404). next-intl préfixe les routes racine même sans
middleware — toute route technique doit vivre sous `/api/`.

**Docker.** Pas de `docker-compose.yml` : trois fichiers distincts, dont
`docker-compose.local.yml` pour le dev local. Toujours passer `-f`.

**Le `.next` du frontend local est un volume nommé.** Après une reconstruction de la base ou un
changement de routes, un `restart` ne suffit pas : purger le volume, sinon *toutes* les routes
dynamiques renvoient 404. Test discriminant : si une route **sans rapport** tombe aussi en 404,
c'est l'environnement, pas le code.

**Le backend en Docker ne recharge pas à chaud** (`tsx watch` ne voit pas les écritures de
l'hôte) : redémarrer le conteneur après une modification.

**Tests backend depuis l'hôte** : préfixer `DATABASE_URL` sur `localhost:5432`, sinon ~44 faux
échecs en 500.

**Prisma 7** : `migrate dev` est interactif et inutilisable ici — écrire les migrations à la main.

**Sponsors et speakers sont des entités partagées entre éditions** (#129, #351) : le slug
identifie une *entreprise* ou une *personne*, pas une participation. Ce qu'une édition a affiché
(logo, libellé de niveau) est **figé** sur la participation (#375) — un écran qui édite « le
logo » doit dire de quelle année il parle.

**`User.role` vaut `EDITOR` par défaut, et `EDITOR` ouvre le back-office.** Tout compte tiers
(sponsor, speaker) doit porter un rôle neutre explicite à la création. Détail dans
`.claude/rules/security.md`.

## Comptes de dev local

Provisionnés par `src/backend/prisma/seed-dev.ts` (lancé à la main) — connexion sur `/admin` :

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| ADMIN | `admin@devfesttoulouse.fr` | `admin1234!dev` |
| EDITOR | `editor@devfesttoulouse.fr` | `editor1234!dev` |

Après un reseed, `seed.ts` l'emporte sur `seed-dev.ts` et le mot de passe admin ne marche plus :
recréer le compte via l'API auth. Détails dans `docs/comptes-dev-local.md`.

## Documentation

Consulter avant de faire des hypothèses sur le métier ou l'architecture. `docs/` (en français) :

| Fichier | Contenu |
|---|---|
| `fonctionnalites-2026.md` | Périmètre fonctionnel (pages, composants, rôles) |
| `objectifs-techniques.md` | SSR + cache, Lighthouse ≥90, Core Web Vitals, SEO, WCAG 2.1 AA, i18n |
| `modele-donnees-metier.md` | Entités, relations, stratégie bilingue |
| `modele-donnees-historique.md` | Schéma de `devfest-history.json` (327 speakers, 279 sessions) |
| `historique-sites.md` | Évolution des sites passés (2016-2025) |
| `design-system.md` | Charte, palette, tokens, kit UI |
| `maquettes-figma.md` | Inventaire des maquettes ([Figma](https://www.figma.com/design/5dw9ggMfrdFrB9qEKYvHH6/DevFestToulouse-2025?node-id=22-499)) |
| `api-publique.md` | API REST publique (OpenAPI/Swagger) |
| `variables-environnement.md` | Variables d'environnement |
| `comptes-dev-local.md` | Comptes de test, MailHog |
| `priorisation-developpement.md` | Lots de développement, rétroplanning 2026 |
| `mise-en-production.md` | Procédure de déploiement en production |
| `deployer-nouvel-environnement.md` | Ajouter un environnement (`dev-x`, beta, prod) |
| `coolify-pieges-multi-environnements.md` | Pièges Coolify récurrents |
| `traduction-ia.md` | Traduction assistée pour les éditeurs |

## Décisions structurantes

- **Rendu** : SSR + cache HTTP sur les pages publiques (`s-maxage=3600, stale-while-revalidate=60`),
  invalidation à la demande depuis l'admin ; SSR+SPA hybride sur les pages authentifiées.
- **Accueil** : contenu conditionné par le statut de l'édition (préparation / annonce / à l'année prochaine).
- **Rôles** : admin, sponsor, speaker — sponsors et speakers éditent leur fiche via magic link.
- **SEO** : Schema.org (Event, Organization, Person, Article), Open Graph, images OG dynamiques.
- **i18n** : bilingue FR (défaut) + EN, URLs localisées.

## Règles impératives

- Étager les fichiers un par un — jamais `git add .` ni `git add -A`
- Une commande git par appel Bash — jamais de `&&`, jamais `cd`, jamais `git -C`
- Jamais de force-push sur `main`, jamais de `--no-verify`
- Utiliser Context7 MCP pour la doc des bibliothèques avant de les employer

## Règles détaillées

À lire quand le sujet se présente — ne pas charger d'avance :

| Fichier | Quand |
|---|---|
| `.claude/rules/git-workflow.md` | Commits, branches, PR, worktrees |
| `.claude/rules/issue-lifecycle.md` | Fermer, étiqueter (`corrigé`) ou rattacher une issue |
| `.claude/rules/testing.md` | Écrire ou lancer des tests, vérifier avant de pousser |
| `.claude/rules/security.md` | Auth, secrets, validation d'entrées, headers, ouverture des comptes |
| `.claude/rules/error-handling.md` | Gestion et remontée des erreurs |
| `.claude/rules/code-quality.md` | Imports, taille, duplication, performance |
| `.claude/rules/coding-style.md` | Nommage, constantes, formatage |
| `.claude/rules/task-management.md` | Mode plan, sous-agents, compaction |
| `.claude/rules/communication.md` | Langue, workflow de correction |
