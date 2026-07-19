# Mise en production (prod)

Procédure complète pour déployer et alimenter l'environnement **production**
(`https://site.devfesttoulouse.fr`, branche `main`, `docker-compose.prod.yml`),
et migrer le contenu depuis la beta.

> Complète [`deployer-nouvel-environnement.md`](deployer-nouvel-environnement.md)
> (config Coolify générique) et [`variables-environnement.md`](variables-environnement.md)
> (référence des variables). Ce document ajoute les étapes et pièges **spécifiques
> à la prod** identifiés lors de la première mise en production.

---

## Vue d'ensemble

```
0. Pré-vol : fenêtre de déploiement + revue des migrations Prisma
1. Choisir le numéro de version + bumper (dans la PR de promotion)
2. Promouvoir le code sur main (PR dev → main)
3. Créer / configurer la ressource Coolify prod
4. Sauvegarder la base prod (si la release contient une migration)
5. Déployer
6. Vérifier (checklist + smoke tests)
7. Taguer + publier la release GitHub
8. (à la demande) Migrer les données depuis la beta
9. (plus tard) Basculer le DNS sur le domaine final → active le SEO

En cas de problème → Rollback (voir la section dédiée en fin de document).
```

---

## 0. Pré-vol

Avant de lancer quoi que ce soit :

### Fenêtre de déploiement

- **Ne pas déployer à J-1 du DevFest** ni pendant un pic connu (ouverture de
  billetterie, campagne d'annonce). Un bug en prod à ce moment est très coûteux.
- **Prévenir l'équipe** avant de pousser en prod (canal habituel).
- Privilégier un créneau où quelqu'un peut réagir en cas de souci (pas un vendredi soir).

### Revue des migrations Prisma

Le backend joue les migrations **automatiquement au boot**. Il faut donc savoir
**ce qui va s'exécuter sur la base prod** avant de déployer :

```bash
# Migrations qui partiraient en prod
git diff --stat origin/main..origin/dev -- src/backend/prisma/migrations/

# Lire le SQL — repérer les opérations DESTRUCTIVES (DROP, ALTER … DROP COLUMN,
# TRUNCATE, renommages) qui peuvent perdre des données
git diff origin/main..origin/dev -- src/backend/prisma/migrations/
```

- **Aucune migration** → déploiement à faible risque, backup DB facultatif.
- **Migration présente** → backup obligatoire (étape 4). Toute opération destructive
  doit être **consciente et assumée** (une colonne `DROP` ne se rollback pas en
  redéployant l'ancien code — la donnée est déjà partie).

### Hygiène des secrets

- **Aucun secret dans le diff promu** : vérifier qu'aucune clé/mot de passe/token
  n'a été committé (`git diff origin/main..origin/dev` — chercher `SECRET`, `KEY`,
  `PASSWORD`, `TOKEN`). Les secrets vivent **uniquement** côté Coolify (runtime).
- **Ne jamais logger un secret** : ni en clair dans les logs, ni dans un message
  d'erreur renvoyé au client.
- **Rotation** : après tout doute de fuite (secret affiché en clair, poussé par
  erreur), le régénérer (`openssl rand -hex 32`) et le remplacer dans Coolify.

---

## 1. Choisir le numéro de version et le bumper

**Règle : une mise en prod = une nouvelle version.** Chaque déploiement sur
`main` porte un numéro **SemVer** (`MAJOR.MINOR.PATCH`) tagué et publié en release.

### Choisir le bump (SemVer)

Regarder les commits promus (`git log --oneline origin/main..origin/dev`) et
appliquer les préfixes Conventional Commits déjà en place :

| Bump | Quand | Exemple |
|------|-------|---------|
| **MAJOR** (`2.0.0`) | Changement cassant, refonte, migration lourde du modèle | Refonte du modèle Speaker (#123) |
| **MINOR** (`1.1.0`) | Nouvelle fonctionnalité (`feat:`), sans casse | Badge version admin (#171) |
| **PATCH** (`1.0.1`) | Correctif de bug (`fix:`), doc, chore | Fix pagination articles (#165) |

En cas de mix, le plus haut l'emporte (un `feat:` parmi des `fix:` → MINOR).

### Bumper la source de vérité (dans la PR de promotion)

La version affichée dans l'admin vient de [`APP_VERSION`](../src/backend/src/lib/version.ts)
(exposée par `GET /api/health`, cf. #171). Elle **doit** être incrémentée
**dans la PR `dev → main`**, sinon la prod afficherait l'ancien numéro.

Mettre à jour, dans la même PR :

1. `APP_VERSION` dans [`src/backend/src/lib/version.ts`](../src/backend/src/lib/version.ts)
2. `version` dans [`src/backend/package.json`](../src/backend/package.json)
3. `version` dans [`src/frontend/package.json`](../src/frontend/package.json) (cohérence)

> Le tag git (`v1.2.3`) et la release GitHub, eux, se posent **après** le
> déploiement vérifié (étape 6) — pas maintenant.

### La ligne `dev` porte la version à venir, suffixée `-beta`

Sans ça, la bêta et la prod afficheraient le **même** numéro tout en contenant
un code différent — et rien ne le signalerait dans l'admin.

Convention :

| Branche | Version | Exemple |
|---------|---------|---------|
| `main` (prod) | version publiée | `1.3.0` |
| `dev` / `dev-{initiale}` (bêta) | **version à venir** + `-beta` | `1.4.0-beta` |

- Le suffixe dit « numéro pressenti, pas encore figé » : il reste ajustable tant
  que la promotion n'a pas eu lieu (si le périmètre change, `1.4.0-beta` peut
  devenir `2.0.0-beta`). C'est un pre-release SemVer valide : `1.4.0-beta` < `1.4.0`.
- **La PR de promotion `dev → main` retire simplement le suffixe** (`1.4.0-beta`
  → `1.4.0`) dans les 3 fichiers ci-dessus — c'est ça, le « bump » de l'étape 1.
- **Juste après le tag**, repasser la ligne `dev` sur la version suivante en
  `-beta` (`1.4.1-beta` ou `1.5.0-beta`), sinon la bêta réaffiche le numéro de
  la prod. Voir l'étape 7.

---

## 2. Promouvoir le code sur `main`

La prod tourne sur `main`. Toute correction doit y arriver via une PR `dev → main`.

- Stratégie de merge : **squash** (règle du repo).
- ⚠️ **Faux conflit après squash** : comme les PR vers `dev` sont squashées, les
  SHA divergent et une PR `dev → main` peut afficher un conflit `add/add` alors
  que le diff réel est trivial. Résolution : créer une branche
  `promote/xxx-to-main` depuis `dev`, y `git merge origin/main`, résoudre en
  gardant la version de `dev`, puis PR depuis cette branche.
- Vérifier le **diff réel** avant : `git diff --stat origin/main..origin/dev`.

---

## 3. Créer / configurer la ressource Coolify prod

Suivre [`deployer-nouvel-environnement.md`](deployer-nouvel-environnement.md), avec
pour la prod :

- **Branch** : `main`
- **Build Pack** : Docker Compose
- **Base Directory** : `/`
- **Docker Compose Location** : `/docker-compose.prod.yml`

> Le champ **Domains** n'apparaît qu'**après** « Load Compose File » (Coolify doit
> d'abord parser le compose pour connaître le service `frontend`). Si `main` ne
> contient pas encore le compose, le Load échoue → merger la PR d'abord.

### Variables d'environnement prod

Voir [`variables-environnement.md`](variables-environnement.md) pour la liste
complète. Spécifique prod :

| Variable | Valeur | Available at Buildtime |
|----------|--------|:----------------------:|
| `ENV_NAME` | `prod` | ✅ |
| `BASE_URL` | `https://site.devfesttoulouse.fr` | ✅ |
| `BACKEND_URL` | `http://devfest-prod-backend:4000` | ✅ |
| `NEXT_PUBLIC_PLAUSIBLE_SRC` | URL du script Plausible (ou vide) | ✅ |
| `SESSION_SECRET` | `openssl rand -hex 32` | ❌ (runtime) |
| autres secrets | générés / consoles tierces | ❌ (runtime) |

- `ENV_NAME`, `BASE_URL`, `BACKEND_URL`, `NEXT_PUBLIC_PLAUSIBLE_SRC` **doivent** être
  cochés « Available at Buildtime » (lues par `next build` / interpolées dans le
  compose). Les secrets restent runtime.
- **Better Auth** utilise `SESSION_SECRET` comme secret (mapping dans
  [`src/backend/src/lib/auth.ts`](../src/backend/src/lib/auth.ts)). En prod
  (`NODE_ENV=production`), un secret **est obligatoire** sinon le backend crashe
  au boot (voir *Pièges* §A). `BETTER_AUTH_SECRET` est accepté en repli.

---

## 4. Sauvegarder la base prod (si la release contient une migration)

**Obligatoire dès qu'une migration Prisma est présente** (étape 0). Le déploiement
joue les migrations au boot ; sans dump préalable, une migration qui corrompt ou
supprime des données est **irrécupérable**.

```bash
PROD_DB=<db-prod>   # le conteneur db dont le BASE_URL est site.devfesttoulouse.fr
STAMP=$(date +%Y%m%d-%H%M%S)

sudo docker exec "$PROD_DB" pg_dump -U devfest -d devfest \
  --no-owner --no-privileges > "/root/backups/prod-$STAMP.sql"

# Vérifier que le dump n'est pas vide
ls -lh "/root/backups/prod-$STAMP.sql"
```

Garder au moins le dernier dump avant chaque déploiement à migration. En cas de
problème, il sert au rollback (voir section dédiée).

---

## 5. Déployer

Lancer **Deploy** dans Coolify. Le build compile frontend + backend puis le
backend joue les migrations Prisma et le seed idempotent au démarrage.

> **Prérequis pour la traçabilité du build** (#290) : le compose passe
> `APP_COMMIT=${SOURCE_COMMIT:-}` en argument de build au backend. `SOURCE_COMMIT`
> est fourni par Coolify ; s'il est vide, `/api/health` ne renvoie simplement pas
> de `commit` et l'on perd ce marqueur — sans casser le déploiement.

---

## 6. Vérifications obligatoires

En plus de la checklist de [`deployer-nouvel-environnement.md`](deployer-nouvel-environnement.md)
(BACKEND_URL runtime + build, alias DNS, sign-in) :

```bash
# Le domaine résout-il vers le VPS ? (bypass cache local)
dig +short site.devfesttoulouse.fr @8.8.8.8

# Réponse HTTP réelle (‑k ignore le certif auto-signé transitoire)
curl -sSk -I https://site.devfesttoulouse.fr/

# Le frontend répond en interne (contourne Traefik)
FRONT=$(sudo docker ps --format '{{.Names}}' | grep '^frontend-' | grep <hash-prod>)
sudo docker exec "$FRONT" wget -qO- http://localhost:3000/fr | head -c 200
```

Résultats attendus : `dig` renvoie l'IP du VPS ; `curl` renvoie 200/redirection ;
le frontend interne renvoie du HTML.

**Vérifier la version déployée** (cf. #171) : le badge `v{version} · prod` dans
la sidebar admin doit afficher le **nouveau** numéro. Sinon, `APP_VERSION` n'a pas
été bumpé (étape 1) ou le build n'a pas été régénéré.

```bash
curl -s https://site.devfesttoulouse.fr/api/health
# → {"status":"ok","version":"1.2.3","environment":"prod","commit":"7d90b17", ...}
```

**Vérifier le commit déployé** (cf. #290) : `commit` porte le SHA court du build,
injecté par Coolify (`SOURCE_COMMIT`) au moment du build. C'est le seul marqueur
fiable **entre deux releases** — sur la ligne `dev`, la version ne bouge pas d'un
merge à l'autre, donc elle ne dit pas si le déploiement a réellement pris.

```bash
# Le commit déployé en beta correspond-il bien à la tête de `dev` ?
curl -s https://beta.site.devfesttoulouse.fr/api/health | grep -o '"commit":"[^"]*"'
git rev-parse --short origin/dev
```

Les deux doivent coïncider. Sinon, le déploiement n'a pas eu lieu (ou a échoué et
l'ancien conteneur tourne toujours). Le badge de la sidebar admin affiche ce même
SHA, cliquable vers le commit GitHub.

> `commit` est **absent** de la réponse hors CI/Coolify (build local) : c'est
> normal, il ne signale pas une anomalie.

### Smoke tests — parcours critiques

Au-delà des sondes techniques, tester **manuellement** les parcours qui cassent le
plus souvent après un déploiement (idéalement dans un navigateur, sur le domaine prod) :

- [ ] **Home** `/fr` : rendu correct, pas d'erreur console.
- [ ] **Login admin** `/admin` : connexion OK, dashboard s'affiche.
- [ ] **Billetterie** `/fr/billetterie` : les tarifs s'affichent avec le bon statut.
- [ ] **Article** : une page d'actualité s'ouvre et affiche son contenu.
- [ ] **Contact** `/fr/contact` : le formulaire s'envoie (email reçu côté MailHog/Postfix).
- [ ] **Images** : logos et images d'articles se chargent (pas de 404 sur `/uploads/`).

---

## 7. Taguer + publier la release GitHub

Une fois le déploiement **vérifié**, figer l'état avec un tag git et une release.
Le tag pointe sur le commit de `main` réellement en prod.

```bash
# Se placer sur le main à jour
git checkout main
git pull origin main

# GARDE-FOU : vérifier AVANT de taguer que le code de main porte bien le numéro
git show main:src/backend/src/lib/version.ts | grep APP_VERSION
# → doit afficher APP_VERSION = "1.2.3". Si ce n'est pas le cas, le bump de
#   l'étape 1 n'a pas été promu : NE PAS taguer, corriger d'abord.

# Taguer (annotated) — numéro identique à APP_VERSION
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3

# Publier la release avec des notes auto-générées depuis les PR mergées
gh release create v1.2.3 \
  --repo GDGToulouse/Site-Devfest-Toulouse-2026 \
  --title "v1.2.3" \
  --generate-notes
```

- `--generate-notes` compile les PR mergées depuis le tag précédent.
- Le tag doit être **identique** à `APP_VERSION` (sinon l'admin et la release
  divergent) — vérifié **avant** le push ci-dessus.
- **Un seul tag par version.** Ne jamais déplacer un tag déjà poussé.

### Mettre à jour le CHANGELOG

Reporter la release dans [`CHANGELOG.md`](../CHANGELOG.md) (format
[Keep a Changelog](https://keepachangelog.com/fr/)) — donne un historique lisible
hors GitHub, versionné avec le code. En pratique, l'ajouter dans la **PR de
promotion** (étape 1) : une section `## [1.2.3] - AAAA-MM-JJ` listant les
changements (Ajouté / Corrigé / Modifié). La release GitHub peut réutiliser ce texte.

### Redescendre la version sur la ligne `dev` (à ne pas oublier)

Le bump de l'étape 1 n'existe que sur `main`. Sans cette étape, `dev` et
`dev-{initiale}` restent sur l'ancien numéro : la bêta finit par annoncer une
version **plus ancienne que la prod**, ce qui rend le badge de l'admin trompeur.

Après le tag, ouvrir une PR `main → dev` (puis `dev → dev-{initiale}`) qui :

1. reporte `CHANGELOG.md` (la section de la release qui vient d'être publiée) ;
2. repositionne les 3 fichiers de version sur la **prochaine** version en
   pre-release — `1.4.0` publiée → `1.4.1-beta` (ou `1.5.0-beta` selon ce qui
   s'annonce).

```bash
# Contrôle : les 3 lignes doivent concorder
git show origin/main:src/backend/src/lib/version.ts | grep APP_VERSION  # 1.4.0
git show origin/dev:src/backend/src/lib/version.ts  | grep APP_VERSION  # 1.4.1-beta
curl -s https://beta.site.devfesttoulouse.fr/api/health                 # 1.4.1-beta
```

> ℹ️ La skill **`deploy-to-prod`** (`.claude/skills/deploy-to-prod`) automatise
> le choix du bump, le rappel de tous ces garde-fous et la génération de ces
> commandes.

---

## 8. Migrer les données depuis la beta — **à la demande uniquement**

> 🚫 **Cette étape n'est PAS systématique.** Un déploiement de prod **ne migre
> jamais** les données par défaut. La migration beta → prod est un geste **explicite**,
> déclenché **à la demande du développeur** dans un cas précis (ex. première mise en
> prod, ou synchronisation ponctuelle décidée). En routine, la prod garde ses
> propres données ; on ne déploie que du **code**.

> ⚠️ **C'est un écrasement complet** (`pg_dump --clean`) : elle **détruit** le
> contenu prod actuel pour le remplacer par celui de la beta. Ne jamais la lancer
> « par acquit de conscience ».

La base prod démarre avec un seed minimal. Pour l'alimenter avec le contenu réel,
copier depuis la **beta** (base + fichiers uploadés).

> ⚠️ **Identifier le BON environnement source.** Sur le VPS coexistent plusieurs
> déploiements DevFest (prod, beta, dev-j…). Ne pas se fier au hash : vérifier le
> `BASE_URL` de chaque conteneur pour distinguer beta (`beta.site…`) de dev-j
> (`dev-j.site…`).

```bash
# Repérer les conteneurs par domaine
for c in $(sudo docker ps --format '{{.Names}}' | grep '^frontend-'); do
  echo "$c → $(sudo docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$c" | grep '^BASE_URL=')"
done
```

### 5.1 Base de données (dump beta → restore prod)

`--clean --if-exists` supprime et recrée les tables : c'est un **remplacement
complet**, pas un merge. Rejouable sans risque de doublon.

```bash
BETA_DB=<db-beta>       # le conteneur db dont le BASE_URL est beta.site…
PROD_DB=<db-prod>

sudo docker exec "$BETA_DB" pg_dump -U devfest -d devfest \
  --clean --if-exists --no-owner --no-privileges \
| sudo docker exec -i "$PROD_DB" psql -U devfest -d devfest
```

Sortie attendue : des `CREATE TABLE` / `COPY n` / `setval`, **aucun `ERROR:`**
(les `NOTICE … skipping` sont normaux).

### 5.2 Fichiers uploadés (volume `uploads`)

Le dump SQL ne contient **pas** les fichiers (images, logos, PDF). Les copier
séparément, sinon les images sont cassées en prod.

```bash
BETA_BACK=<backend-beta>
PROD_BACK=<backend-prod>

rm -rf /tmp/devfest-uploads && mkdir -p /tmp/devfest-uploads
sudo docker cp "$BETA_BACK":/app/uploads/. /tmp/devfest-uploads/
sudo docker cp /tmp/devfest-uploads/. "$PROD_BACK":/app/uploads/
sudo rm -rf /tmp/devfest-uploads
```

### 5.3 Redémarrer le backend prod

```bash
sudo docker restart <backend-prod>
```

### 5.4 Vérifications post-migration

```bash
# Contenu attendu (ex. articles)
sudo docker exec <db-prod> psql -U devfest -d devfest -c \
  "SELECT COUNT(*), MIN(\"publishedAt\")::date, MAX(\"publishedAt\")::date FROM \"Article\";"

# Aucune URL absolue 'beta.site' résiduelle en base (sinon UPDATE … REPLACE)
sudo docker exec <db-prod> psql -U devfest -d devfest -c \
  "SELECT \"imageUrl\" FROM \"Article\" WHERE \"imageUrl\" LIKE '%beta.site%' LIMIT 5;"
```

- Les URLs de fichiers sont stockées en **relatif** (`/uploads/…`) ; le domaine est
  ajouté au runtime via `BASE_URL`. Aucune correction d'URL n'est normalement
  nécessaire.
- **Sessions admin** : les comptes sont copiés, mais les sessions beta deviennent
  invalides (secrets prod différents) → se reconnecter sur `…/fr/admin`.

---

## 9. Basculer le DNS sur le domaine final (SEO)

Tant que `BASE_URL` ≠ `https://devfesttoulouse.fr`, le site est **volontairement
non indexé par Google mais reste partageable sur les réseaux sociaux**
(`robots.txt` = `Disallow: /` + une meta `noindex` ciblée **uniquement sur
Googlebot** — pas de `noindex` global, sinon `facebookexternalhit` refuse
l'aperçu Open Graph, cf. #169). C'est un test d'égalité stricte dans
[`robots.ts`](../src/frontend/src/app/robots.ts) et
[`layout.tsx`](../src/frontend/src/app/[locale]/layout.tsx).

Le jour du basculement DNS, **sans modifier le code** :

1. **Domains for frontend** (Coolify) → `https://devfesttoulouse.fr`
2. Variable **`BASE_URL`** → `https://devfesttoulouse.fr` (Buildtime coché)
3. **Redeploy without cache** (pour régénérer le bundle Next figé au build)

→ l'indexation SEO s'active automatiquement.

---

## Rollback — revenir en arrière

Si la prod est cassée après un déploiement, **ne pas improviser**. Deux cas.

### Cas 1 — la release ne contenait PAS de migration (code seul)

Le rollback est simple : **redéployer le tag précédent**.

1. Dans Coolify, pointer la ressource sur le commit/tag précédent (`vX.Y.(Z-1)`)
   ou revert la PR de promotion, puis **Redeploy without cache**.
2. Vérifier `/api/health` → la version doit redescendre au numéro précédent.

> Ne **jamais** supprimer/déplacer le tag fautif. Créer plutôt un correctif
> (`vX.Y.Z+1`) ou assumer le retour au tag précédent.

### Cas 2 — la release contenait une migration Prisma

Redéployer l'ancien code **ne suffit pas** : la base a déjà changé (une colonne
`DROP` est perdue). Il faut **restaurer le dump** pris à l'étape 4.

```bash
PROD_DB=<db-prod>
DUMP=/root/backups/prod-<STAMP>.sql     # le dump d'avant CE déploiement

# Restauration COMPLÈTE (écrase l'état courant)
cat "$DUMP" | sudo docker exec -i "$PROD_DB" psql -U devfest -d devfest

# Puis redéployer le code de la version précédente (cas 1)
```

- **Sans dump préalable, pas de rollback propre possible** → d'où l'étape 4 obligatoire.
- Après restauration, revérifier les smoke tests (étape 6).

---

## Pièges rencontrés (première mise en prod)

### A. Backend en crash-loop : `BetterAuthError: default secret`

Symptôme : le backend redémarre en boucle et s'arrête (10/10 restarts), log
`[BetterAuthError: You are using the default secret]` pendant le seed.

Cause : Better Auth n'échoue **que** si `NODE_ENV=production` **et** qu'aucun
secret n'est fourni. Le compose prod force `NODE_ENV=production`, ce qui active
cet enforcement (absent en dev/beta).

Fix (déjà en place dans le code) : `secret: SESSION_SECRET` dans `auth.ts`. Il
suffit donc que `SESSION_SECRET` soit défini côté Coolify.

### B. Page blanche / DNS

`curl: Could not resolve host` → l'enregistrement DNS du sous-domaine n'existe pas
encore. Créer un **A record** `site` → IP publique du VPS chez le registrar (OVH).
Tester la propagation avec `dig +short … @8.8.8.8`.

### C. `503 no available server` (Traefik)

Le domaine résout mais Traefik renvoie 503 : le conteneur frontend **n'a pas le
label `traefik.enable`**, car le champ **Domains** de la ressource n'a pas été
renseigné dans Coolify. Remplir Domains (`https://site.devfesttoulouse.fr`) sur le
service frontend, Save, Redeploy. Coolify régénère alors les labels Traefik + le
déclencheur du certificat Let's Encrypt.

### D. Certificat `TRAEFIK DEFAULT CERT` (auto-signé)

Conséquence d'un 503 non résolu : Let's Encrypt ne peut pas valider une route qui
renvoie 503. Le vrai certificat est émis une fois le §C corrigé et une première
requête HTTPS effectuée sur le domaine.

### E. Mauvais environnement source à la migration

Copier depuis dev-j au lieu de beta donne un contenu périmé. Toujours vérifier le
`BASE_URL` du conteneur source (§5) avant de dumper. Le dump étant un remplacement
complet (`--clean`), il suffit de rejouer depuis la bonne source pour corriger.
