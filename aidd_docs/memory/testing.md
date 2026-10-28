# Testing

## Strategy

- Tests unitaires et d'intégration colocalisés ; l'intégration est préférée dès qu'un flux de données est en jeu
- Les tests d'intégration backend tapent une vraie base PostgreSQL, partagée et en parallèle, et lisent les données de démo que **seul `seed-dev.ts` crée**
- Pas de suite e2e automatisée : le parcours réel se vérifie dans le navigateur

## Tools

- Vitest partout, Testing Library côté frontend
- Vérification navigateur : MCP Chrome DevTools, et MCP Playwright en trois instances (`playwright-chrome`, `playwright-firefox`, `playwright-webkit` pour Safari), déclarés dans `.mcp.json` ; Playwright écrit ses sorties dans `.playwright-mcp/` (ignoré par git). Firefox et WebKit demandent une fois `npx playwright install firefox webkit`

## Conventions

- Règles complètes : `.claude/rules/testing.md` (nommage, test rouge avant le correctif, un commit par correctif)
- Les suites backend partagent une base et tournent en parallèle : chaque fichier possède ses années d'édition (`Edition.year` est `@unique`, `test-year-ownership.test.ts` refuse un doublon entre 1500 et 2005), et un nettoyage qui filtre sur un id posé en `beforeAll` se garde par `if (id !== undefined)`. Un `deleteMany` / `updateMany` au filtre vide ou `undefined` est refusé par `src/__tests__/support/guard-unscoped-writes.ts`, chargé pour tous les fichiers (#681) : Prisma écarte la clé `undefined`, et le nettoyage d'une suite dont le `beforeAll` a échoué effaçait toute la table, données de démo comprises
- Un échec isolé qui ne se reproduit pas est d'abord une collision de fixtures : relancer avant d'enquêter, et le dire
- « Tests N passed » ne veut pas dire vert : une exception non interceptée pendant un rendu sort en « Unhandled Errors / Errors 1 error » et fait échouer la CI. Lire le code de sortie de `vitest run` (ou la ligne `Errors`), jamais la seule ligne `Tests` (#416, mock de `/files` resté à l'ancienne forme)
- Une base locale déjà pleine masque les échecs « données manquantes ». Reproduire la CI = `migrate deploy` + `seed-dev.ts` + tests sur une **base fraîche**
- `BASE_URL` vaut `/` sous Vitest (injecté par Vite) : ne jamais asserter l'origine, asserter la distinction que fait la fonction. `console.log` ne s'affiche pas : pour lire une valeur, écrire une assertion volontairement fausse et lire le « Received »
- La suite frontend est épinglée sur `TZ=Europe/Paris` : un test d'heure ne prouve rien s'il ne recharge pas le module sous `vi.stubEnv("TZ", "UTC")` après `vi.resetModules()`
- Pas de Gemini dans les tests backend : `vi.mock("../lib/translation/index.js", …)` en gardant les vraies classes d'erreur par `importActual`, `isConfigured` et `translate` remplacés (modèle : `src/backend/src/__tests__/admin-articles-translate.test.ts`)
- Une clé i18n trouvée par `grep` peut appartenir à un autre namespace : tester que **chaque clé produite se résout** dans les deux langues (modèle : `src/frontend/src/lib/nav.test.ts`)

## Run

- Commandes et ordre : `coding-assertions.md`

## Browser QA

- Entry: `docker compose -f docker-compose.local.yml up -d`, puis `http://localhost:3000` ; back-office sur `/admin` (pas `/fr/admin`)
- Auth: `admin@devfesttoulouse.fr` / `admin1234!dev` (ADMIN) et `editor@devfesttoulouse.fr` / `editor1234!dev` (EDITOR), reposés par `seed-dev.ts` même sur des comptes existants (#433) — `docs/comptes-dev-local.md`. En local et en CI seulement : sur `dev-j`, les mêmes comptes prennent `DEV_SEED_PASSWORD` et MailHog demande `MAILHOG_USER` / `MAILHOG_PASSWORD` (variables Coolify, que Julien détient)
- Auth sponsor: `responsable@aeronova.example.com` (deux fiches) et `editeur@cassoulet.example.com`, mot de passe `sponsor1234!dev`, posés par `seed-dev.ts` sur `/sponsor/login`. Pour tester l'invitation elle-même : créer un contact (`POST /api/admin/sponsors/<id>/contacts`), lire l'invitation dans MailHog (`http://localhost:8025/api/v2/messages`, corps en quoted-printable), **se déconnecter** avant d'ouvrir `/sponsor/invitation/<token>`, puis relancer `seed-dev.ts` pour nettoyer
- State: `src/backend/prisma/seed-dev.ts`, lancé à la main
- Multi-navigateur : tout changement de mise en page (tableau, grille, `sticky`, hauteurs) se vérifie aussi dans Firefox et WebKit. Chrome seul a laissé passer en prod une grille du programme écrasée sous Firefox (#550). Comparer des mesures (hauteur, débordement via `scrollHeight`) plutôt que des captures à l'œil

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
- **Aucune purge de cache en local** sans `REVALIDATE_SECRET` dans `.env` (il n'y a pas de `.env` par défaut) : un enregistrement admin ne change la page qu'au bout d'une heure. Vider `.next/cache/fetch-cache` puis redémarrer le frontend, ou poser le secret dans `.env`
- **Changer une dépendance du frontend** : `pnpm add` dans le conteneur qui tourne tue `next dev` en pleine installation, et rien n'est écrit. Arrêter le service, puis `docker compose -f docker-compose.local.yml run --rm --no-deps -T frontend sh -c 'corepack enable && corepack prepare pnpm@9.15.4 --activate && pnpm add …'` (l'image nue n'a pas pnpm). Pour une dépendance transitive : `pnpm update --no-save --depth Infinity <paquet>` ; sans `--no-save`, pnpm réécrit aussi les plages des dépendances directes
- **Service worker de `/arrivees`** (#641) : absent sous `next dev`. Après le build de production dans le conteneur, servir ce build à côté, sur le port 3001 (même cookie de session : un cookie `localhost` ignore le port) : `MSYS_NO_PATHCONV=1 docker run -d --name devfest-pwa-check -p 127.0.0.1:3001:3000 --network site-devfest-toulouse-2026_default -v "<dépôt>/src/frontend:/app" -v site-devfest-toulouse-2026_frontend_node_modules:/app/node_modules -v site-devfest-toulouse-2026_frontend_next:/app/.next -w /app -e NODE_ENV=production -e BACKEND_URL=http://backend:4000 node:22-alpine sh -c "corepack enable && corepack prepare pnpm@9.15.4 --activate && pnpm start"`, puis `docker rm -f devfest-pwa-check`. L'émulation « Offline » de Chrome ne coupe pas un flux SSE déjà ouvert : simuler une panne en arrêtant le backend
- **Caméra de l'écran Scan** (#642) : sans webcam, remplacer `navigator.mediaDevices.getUserMedia` dans la page par une fonction qui rend `canvas.captureStream()` d'un canvas où l'on dessine un QR code ou un code-barres (générés par `zxing-wasm/writer`) ; tout le composant tourne alors pour de vrai. Chrome sous Windows n'a pas `BarcodeDetector` : c'est le chemin zxing d'iOS qui s'exécute. WebKit de Playwright sous Windows n'a pas `navigator.mediaDevices` du tout : la caméra ne s'y teste pas, seul un vrai iPhone le fait
- Une édition de test se crée **sous 2016**, même temporaire : `getSeededEdition()` prend la plus récente à partir de 2016, et une édition 2646 créée puis supprimée par une suite a fait échouer d'autres fichiers par clé étrangère ; les échecs du gel de `admin-badges` ont disparu avec elle, sans que le lien soit établi
- `.next/dev/types/{routes.d.ts,validator.ts}` se régénèrent tronqués et font échouer `tsc` sur du code sain : les supprimer, charger une page, relancer
