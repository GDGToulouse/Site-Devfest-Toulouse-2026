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
1. Promouvoir le code sur main (PR dev → main)
2. Créer / configurer la ressource Coolify prod
3. Déployer
4. Vérifier (checklist)
5. Migrer les données depuis la beta
6. (plus tard) Basculer le DNS sur le domaine final → active le SEO
```

---

## 1. Promouvoir le code sur `main`

La prod tourne sur `main`. Toute correction doit y arriver via une PR `dev → main`.

- Stratégie de merge : **squash** (règle du repo).
- ⚠️ **Faux conflit après squash** : comme les PR vers `dev` sont squashées, les
  SHA divergent et une PR `dev → main` peut afficher un conflit `add/add` alors
  que le diff réel est trivial. Résolution : créer une branche
  `promote/xxx-to-main` depuis `dev`, y `git merge origin/main`, résoudre en
  gardant la version de `dev`, puis PR depuis cette branche.
- Vérifier le **diff réel** avant : `git diff --stat origin/main..origin/dev`.

---

## 2. Créer / configurer la ressource Coolify prod

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

## 3. Déployer

Lancer **Deploy** dans Coolify. Le build compile frontend + backend puis le
backend joue les migrations Prisma et le seed idempotent au démarrage.

---

## 4. Vérifications obligatoires

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

---

## 5. Migrer les données depuis la beta

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

## 6. Basculer le DNS sur le domaine final (SEO)

Tant que `BASE_URL` ≠ `https://devfesttoulouse.fr`, le site est **volontairement
non indexé** (`robots.txt` = `Disallow: /`, `robots: noindex`). C'est un test
d'égalité stricte dans [`robots.ts`](../src/frontend/src/app/robots.ts) et
[`layout.tsx`](../src/frontend/src/app/[locale]/layout.tsx).

Le jour du basculement DNS, **sans modifier le code** :

1. **Domains for frontend** (Coolify) → `https://devfesttoulouse.fr`
2. Variable **`BASE_URL`** → `https://devfesttoulouse.fr` (Buildtime coché)
3. **Redeploy without cache** (pour régénérer le bundle Next figé au build)

→ l'indexation SEO s'active automatiquement.

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
