# Testing

## Strategy

- Tests unitaires et d'intégration colocalisés ; l'intégration est préférée dès qu'un flux de données est en jeu
- Les tests d'intégration backend tapent une vraie base PostgreSQL, partagée et en parallèle, et lisent les données de démo que **seul `seed-dev.ts` crée**
- Pas de suite e2e automatisée : le parcours réel se vérifie dans le navigateur

## Tools

- Vitest partout, Testing Library côté frontend
- Vérification navigateur : MCP Chrome DevTools et MCP Playwright (sur Chrome), déclarés dans `.mcp.json` ; le second écrit ses sorties dans `.playwright-mcp/` (ignoré par git)

## Conventions

- Règles complètes : `.claude/rules/testing.md` (nommage, test rouge avant le correctif, un commit par correctif)
- Un échec isolé qui ne se reproduit pas est d'abord une collision de fixtures : relancer avant d'enquêter, et le dire
- Une base locale déjà pleine masque les échecs « données manquantes ». Reproduire la CI = `migrate deploy` + `seed-dev.ts` + tests sur une **base fraîche**
- `BASE_URL` vaut `/` sous Vitest (injecté par Vite) : ne jamais asserter l'origine, asserter la distinction que fait la fonction. `console.log` ne s'affiche pas : pour lire une valeur, écrire une assertion volontairement fausse et lire le « Received »
- La suite frontend est épinglée sur `TZ=Europe/Paris` : un test d'heure ne prouve rien s'il ne recharge pas le module sous `vi.stubEnv("TZ", "UTC")` après `vi.resetModules()`
- Pas de Gemini dans les tests backend : `vi.mock("../lib/translation/index.js", …)` en gardant les vraies classes d'erreur par `importActual`, `isConfigured` et `translate` remplacés (modèle : `src/backend/src/__tests__/admin-articles-translate.test.ts`)
- Une clé i18n trouvée par `grep` peut appartenir à un autre namespace : tester que **chaque clé produite se résout** dans les deux langues (modèle : `src/frontend/src/lib/nav.test.ts`)

## Run

- Commandes et ordre : `coding-assertions.md`

## Browser QA

- Entry: `docker compose -f docker-compose.local.yml up -d`, puis `http://localhost:3000` ; back-office sur `/admin` (pas `/fr/admin`)
- Auth: `admin@devfesttoulouse.fr` / `admin1234!dev` (ADMIN) et `editor@devfesttoulouse.fr` / `editor1234!dev` (EDITOR), reposés par `seed-dev.ts` même sur des comptes existants (#433) — `docs/comptes-dev-local.md`
- Auth sponsor: `responsable@aeronova.example.com` (deux fiches) et `editeur@cassoulet.example.com`, mot de passe `sponsor1234!dev`, posés par `seed-dev.ts` sur `/sponsor/login`. Pour tester l'invitation elle-même : créer un contact (`POST /api/admin/sponsors/<id>/contacts`), lire l'invitation dans MailHog (`http://localhost:8025/api/v2/messages`, corps en quoted-printable), **se déconnecter** avant d'ouvrir `/sponsor/invitation/<token>`, puis relancer `seed-dev.ts` pour nettoyer
- State: `src/backend/prisma/seed-dev.ts`, lancé à la main

## Local environment

Le code local ment souvent ; l'environnement avant le code. Test discriminant : comparer `curl localhost:4000/api/...` (le backend ne ment pas) à ce qu'affiche la page.

- **Aucun conteneur ne recharge à chaud** les écritures de l'hôte, ni le backend (`tsx watch`) ni le frontend (`next dev`) : `docker restart devfest-local-backend` ou `devfest-local-frontend` après toute modification
- **`.next/dev` survit au redémarrage** et sert un état périmé (cache de fetch, CSS compilé, types générés) : `docker exec devfest-local-frontend sh -c 'rm -rf .next/dev'` puis redémarrer
- **404 sur toutes les routes dynamiques** après une reconstruction de la base : un redémarrage ne suffit pas, vider le volume `.next`, et ne pas redémarrer ensuite « pour être sûr »

  ```bash
  docker compose -f docker-compose.local.yml stop frontend
  docker run --rm -v site-devfest-toulouse-2026_frontend_next:/n alpine sh -c 'rm -rf /n/* /n/.[!.]*'
  docker compose -f docker-compose.local.yml up -d frontend
  ```

- **Le compose local ne migre ni ne seede** (pas de `db-boot.sh`) : sur un volume `pgdata` neuf, toutes les tables manquent (`The table … does not exist`). `docker exec devfest-local-backend sh -c 'pnpm exec prisma migrate deploy && pnpm exec tsx prisma/seed.ts && pnpm exec tsx prisma/seed-dev.ts'`
- `.next/dev/types/{routes.d.ts,validator.ts}` se régénèrent tronqués et font échouer `tsc` sur du code sain : les supprimer, charger une page, relancer
