# Coding Assertions

Commandes à lancer avec l'environnement local démarré (`docker compose -f docker-compose.local.yml up -d`). Le backend s'exécute **dans son conteneur** : son `node_modules` est un volume nommé, le dossier de l'hôte est vide.

## Before commit

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `cd src/frontend && pnpm lint` | ESLint frontend |
| 2 | `docker exec devfest-local-backend pnpm typecheck` | Types backend — Vitest ne type pas, et le build Docker (`tsc`) échoue là où les suites passent |

## Before push

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `cd src/frontend && pnpm exec vitest run` | Tests frontend |
| 2 | `docker exec devfest-local-backend pnpm exec vitest run` | Tests backend contre la base locale (`DATABASE_URL` pointe déjà sur `db:5432` dans le conteneur) |
| 3 | `cd src/frontend && pnpm build` | Build Next, qui porte aussi le typage frontend |
| 4 | Vérification dans le navigateur, cf. `testing.md` § Browser QA | Rien n'est poussé sans avoir été vu marcher (`.claude/rules/testing.md`) |

En conteneur, **un échec est attendu et n'est pas à corriger** : `stat-icons.test.ts` (« catalogue parity with the frontend ») lit `src/frontend/src/lib/stat-icons.ts`, et le conteneur backend ne monte que `src/backend`. Il passe en CI, où tout le dépôt est présent.

Depuis l'hôte, les tests backend exigent un `pnpm install` dans `src/backend` et le préfixe `DATABASE_URL="postgresql://devfest:devfest@localhost:5432/devfest?schema=public"` : sans lui, ~44 faux échecs en 500.

## After push

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `gh run list --branch <branche> --limit 3` | La CI et le build ont passé — un push n'est pas fini tant que ce n'est pas lu |
| 2 | MCP Coolify : `list_deployments` sur l'application de la branche, puis `get_deployment` | Sur `dev-j` et `dev` (redéploiement auto), le déploiement du commit poussé est `finished`. À faire **à chaque fois**, sans attendre qu'on le demande : `/api/health` de `dev-j` n'expose pas le commit |

## Behavior

If a fix is needed, spawn 1 agent per assertion to fix (e.g typechecking / tests / rules violated on category UI = 3 agents).
