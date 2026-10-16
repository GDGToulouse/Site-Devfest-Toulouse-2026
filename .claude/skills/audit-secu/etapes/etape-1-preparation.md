
# Audit de sécurité, étape 1/3 : préparation

Cette étape est mécanique : elle collecte des faits, elle ne juge pas. Elle peut tourner sur n'importe quel modèle. Elle produit les entrées de l'étape 2.

## Contexte et autorisation

Je suis mainteneur du dépôt `GDGToulouse/Site-Devfest-Toulouse-2026` (association GDG Toulouse). Je te demande de préparer une revue de sécurité défensive de **notre propre code**, pour corriger les failles avant qu'elles soient exploitées.

## Règles d'engagement

- Périmètre : le code de ce dépôt, son historique git, ses dépendances, sa configuration, et une instance **locale** (`localhost` / `127.0.0.1`).
- Hors périmètre : la production `devfesttoulouse.fr` et tout hôte distant. Aucune requête de test hors localhost.
- Tu ne modifies pas le code applicatif. Tu n'utilises jamais un secret trouvé : tu le masques (4 premiers caractères puis `****`).
- Si une tâche échoue deux fois, tu notes la cause et tu passes à la suivante.

## Tâches

1. Crée le dossier `.security-audit/` et ajoute la ligne `.security-audit/` au fichier `.git/info/exclude` (exclusion locale, le `.gitignore` versionné reste intact).
2. Lis `CLAUDE.md`, `README.md`, `docs/api-publique.md`, `docs/modele-donnees-metier.md`, `aidd_docs/memory/auth.md`, `.claude/rules/security.md`, **`docs/audit-droits-api.md`** (audit des droits du 4 octobre 2026 : constats corrigés, constats ouverts **acceptés**, points vérifiés sans constat), les `package.json` de `src/frontend` et de `src/backend` (pas de workspace pnpm : le `package.json` racine ne sert qu'à `db:generate`), les `docker-compose.*.yml`, `.github/workflows/*`, `.mcp.json` et le contenu de `.claude/`.
3. Écris `.security-audit/01-cartographie.md` avec exactement ces sections :
   - **Stack** : frameworks, ORM, librairie d'authentification, version de Node, avec leurs versions.
   - **Routes** : ne pas le reconstruire à la main. Le script `src/backend/scripts/route-inventory.ts` lit le vrai serveur et sort chaque route avec la garde qu'elle exécute : `docker exec -e LOG_LEVEL=silent devfest-local-backend pnpm exec tsx scripts/route-inventory.ts`. Reprends sa sortie, puis ajoute la colonne `fichier:ligne` du handler.
   - **Rôles et accès**, et où chaque contrôle est implémenté (`aidd_docs/memory/auth.md`) :
     - anonyme ;
     - compte `ADMIN` et compte `EDITOR` (back-office, `requireAdmin` / `requireAdminRole`) ;
     - compte `SPONSOR`, dont les droits viennent de `SponsorContact.accessRole` : `RESPONSABLE` > `EDITEUR` > `STAND` (`requireSponsorAccess`) ;
     - speaker : **pas de compte**, seulement le lien de modification `/edit/<token>` (30 jours) ;
     - clé d'API `dft_` (en-tête `Authorization: Bearer`) ;
     - agent IA par le connecteur MCP (jeton OAuth, `/api/mcp`, consentement sur `/connect`).
   - **Entrées utilisateur** : formulaires, uploads, paramètres d'URL, corps JSON, en-têtes lus par le serveur.
   - **Appels sortants** : fetch d'URL, emails, stockage de fichiers, services tiers.
   - **Usages sensibles** : liste `fichier:ligne` de chaque occurrence de `$queryRaw`, `$executeRaw`, `$queryRawUnsafe`, `$executeRawUnsafe`, `dangerouslySetInnerHTML`, `innerHTML`, `exec(`, `spawn(`, `eval(`, `new Function(`, `fs.` avec chemin non constant, `fetch(` avec URL non constante, `redirect(` avec valeur issue de la requête.
4. Lance l'instance locale : `docker compose -f docker-compose.local.yml up -d` (toujours avec `-f`, il n'y a pas de `docker-compose.yml`). Le compose local **ne migre ni ne seede** : `docker exec devfest-local-backend sh -c 'pnpm exec prisma migrate deploy && pnpm exec tsx prisma/seed.ts && pnpm exec tsx prisma/seed-dev.ts'`. L'inscription est fermée : ne crée pas de comptes, utilise ceux que pose `seed-dev.ts` (`docs/comptes-dev-local.md` : ADMIN, EDITOR, deux comptes SPONSOR de rôles différents). Note-les dans `.security-audit/comptes-test.md`, avec :
   - une clé d'API `dft_` par compte ADMIN et EDITOR, créée depuis `/admin` (Clés API) ;
   - un lien `/edit/<token>` de speaker, généré depuis la fiche d'un speaker du seed (le mail arrive dans MailHog, `http://localhost:8025`).
5. Lance les outils suivants s'ils sont installés ou installables en une commande, et range chaque sortie brute dans `.security-audit/scans/<outil>.txt` :
   - `pnpm audit --json`, une fois dans `src/frontend` et une fois dans `src/backend` (pas de workspace). Le backend s'exécute dans son conteneur : `docker exec devfest-local-backend pnpm audit --json` ;
   - `gitleaks detect --source . --log-opts="--all" --redact` (à défaut `trufflehog git file://. --only-verified`) sur tout l'historique ;
   - `zizmor .github/workflows` (à défaut `actionlint`) ;
   - `curl -sI http://localhost:<port>/` et `curl -sI http://localhost:<port>/api/docs` pour relever en-têtes de sécurité et attributs des cookies.
6. Écris `.security-audit/01-etat.md` : liste des tâches avec statut `OK` ou `ÉCHEC (cause)`, URL et port de l'instance locale, outils indisponibles.

Termine par un résumé de 5 lignes maximum et indique : « Étape suivante : `/audit-secu 2` (Opus 5.5 obligatoire). »
