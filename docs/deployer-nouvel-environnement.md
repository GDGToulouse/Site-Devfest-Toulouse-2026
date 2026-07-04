# Déployer un nouvel environnement (Coolify)

Ce document explique comment ajouter un nouvel environnement (`dev-x`, `beta`, `prod`, ou un environnement éphémère) au projet **Site DevFest Toulouse 2026** sur Coolify, en évitant les pièges identifiés lors du déploiement initial de `dev-j`.

> Pour le contexte général sur la structure des branches/environnements, voir [`.claude/rules/git-workflow.md`](../.claude/rules/git-workflow.md).
> Pour la liste des variables d'environnement disponibles, voir [`variables-environnement.md`](variables-environnement.md).
> Pour la mise en production complète (déploiement + migration des données + pièges prod), voir [`mise-en-production.md`](mise-en-production.md).

---

## TL;DR — checklist de déploiement

1. Créer la ressource Docker Compose dans Coolify, pointer sur la branche cible et le compose file (`docker-compose.dev.yml` ou `docker-compose.prod.yml`).
2. Renseigner les **Domains for frontend** (URL publique du site).
3. Configurer les **Environment Variables** :
   - Variables minimales : `BASE_URL`, `BACKEND_URL`, `ENV_NAME`, `SESSION_SECRET`, `DATABASE_URL` (variables Postgres), `ADMIN_EMAILS`, `SMTP_FROM`, OAuth, etc.
   - **Cocher `Available at Buildtime`** sur les variables utilisées par `next build` :
     - `BACKEND_URL`
     - `BASE_URL`
     - `NEXT_PUBLIC_PLAUSIBLE_SRC` (si analytics actifs)
     - `ENV_NAME` (utilisée pour interpoler l'alias réseau du backend)
4. Faire un **premier déploiement**.
5. Vérifier après déploiement (cf. section *Vérifications obligatoires* ci-dessous).

---

## 1. Créer la ressource Coolify

- Type : **Docker Compose** (Build Pack).
- Source : repo Git du projet, branche cible (`main`, `dev`, `dev-j`, …).
- Compose file :
  - **dev / dev-{initiale}** → `docker-compose.dev.yml` (mode dev, MailHog, seed-dev avec comptes test)
  - **beta / production** → `docker-compose.prod.yml` (mode prod, Postfix, seed minimal)

## 2. Domains

- **Domains for frontend** : URL publique du site (ex. `https://dev-j.site.devfesttoulouse.fr`). Coolify configure Traefik pour router cette URL vers le service `frontend`.
- **Domains for backend** : laisser tel que recommandé par défaut, ou y mettre la même valeur que `BACKEND_URL`. Ce champ ne sert qu'à exposer publiquement le backend si nécessaire **et ne définit pas la variable d'environnement `BACKEND_URL`**.

## 3. Environment Variables — règles cruciales

### Définir `ENV_NAME`

`ENV_NAME` doit valoir le nom court et unique de l'environnement (ex. `dev-j`, `beta`, `prod`, `dev-m`).

Cette variable est interpolée dans `docker-compose.*.yml` pour générer un **alias réseau unique** pour le backend (`devfest-${ENV_NAME}-backend`). Sans elle, deux environnements partagés sur le même VPS Coolify peuvent leak entre eux via DNS (voir section *Pourquoi*).

### Définir `BACKEND_URL`

Toujours utiliser l'alias réseau, jamais le service brut :

```
BACKEND_URL=http://devfest-{ENV_NAME}-backend:4000
```

Exemple pour `dev-j` :

```
BACKEND_URL=http://devfest-dev-j-backend:4000
```

> ⚠️ Ne jamais utiliser `http://backend:4000` — ce nom existe dans plusieurs projets Coolify et la résolution DNS peut tomber sur le backend d'un autre projet via le réseau partagé `coolify`.

### Cocher « Available at Buildtime »

Sur Coolify, **chaque variable d'environnement a un toggle « Available at Buildtime »**. Sans ce toggle, la variable est uniquement exposée au runtime — pas pendant `next build`.

Or `next build` fige certaines valeurs dans le bundle :
- les `rewrites` (donc l'URL backend pointée par les rewrites Next.js → fichier `routes-manifest.json`)
- les variables `NEXT_PUBLIC_*`
- les valeurs lues à la compilation (CSP avec `plausibleOrigin`, etc.)

**Activer « Available at Buildtime » au minimum pour** :
- `BACKEND_URL`
- `BASE_URL`
- `NEXT_PUBLIC_PLAUSIBLE_SRC` (si défini)

### Variables sensibles (secrets)

- `SESSION_SECRET` : générer via `openssl rand -hex 32` (32+ caractères aléatoires).
- `MAGIC_LINK_SECRET` (Lot 2) : idem, distinct du précédent.
- `POSTGRES_PASSWORD` : générer aléatoirement.
- `OAUTH_*_CLIENT_SECRET` : récupérer depuis Google Cloud Console / GitHub OAuth Apps.

Ces secrets ne doivent **pas** être cochés « Available at Buildtime » (uniquement runtime).

### Liste complète

Voir [`variables-environnement.md`](variables-environnement.md).

## 4. Persistent Storage

Le compose déclare un volume `uploads` pour les fichiers uploadés (images, logos…). Coolify le crée automatiquement, mais **vérifier dans `Persistent Storage`** qu'il est bien attaché et qu'il survit aux redéploiements.

## 5. Premier déploiement

Lancer un **Deploy** depuis Coolify. Surveiller les logs de build :
- Le frontend doit builder Next sans erreur (`pnpm build`).
- Le backend doit lancer Prisma generate + seed sans erreur.

Si erreur : corriger d'abord, retenter ensuite.

---

## Vérifications obligatoires après déploiement

À faire systématiquement après le premier déploiement (et après tout changement d'`ENV_NAME` / `BACKEND_URL`).

### 1. La variable `BACKEND_URL` est correcte au runtime

```bash
docker exec <frontend-container-id> env | grep BACKEND_URL
# Attendu : BACKEND_URL=http://devfest-<env-name>-backend:4000
```

### 2. La variable `BACKEND_URL` est intégrée au build Next

```bash
docker exec <frontend-container-id> cat /app/.next/routes-manifest.json | grep -o 'http://[^"]*:4000' | sort -u
# Attendu : http://devfest-<env-name>-backend:4000
# Si on voit http://backend:4000 → la variable n'a pas été cochée "Available at Buildtime" → corriger sur Coolify et redeploy without cache
```

### 3. L'alias DNS résout vers le bon backend

```bash
docker exec <frontend-container-id> getent hosts devfest-<env-name>-backend
# Attendu : une seule IP, dans le sous-réseau du projet (ex. 10.0.x.x), pas une IPv6
```

### 4. Le bon backend reçoit les requêtes

```bash
docker logs -f <backend-container-id-de-cet-env>
# Dans un autre terminal/onglet : se connecter à l'app et déclencher une requête
# Le hostname dans les logs (ex. "hostname":"320dc6066338") doit correspondre au container ID du backend de cet env, pas d'un autre projet.
```

### 5. Le sign-in fonctionne

Naviguer sur l'URL admin (`https://<env>.site.devfesttoulouse.fr/login`) et tenter une connexion avec un compte admin existant. Si retour `INVALID_ORIGIN` (HTTP 403), c'est qu'on parle au mauvais backend (étape 3 ou 4 KO).

---

## Pourquoi ces précautions ?

Coolify a plusieurs comportements qui ne sont pas évidents :

1. **`container_name` dans le compose est ignoré.** Coolify renomme tous les containers avec son propre hash de projet. C'est pour ça qu'on utilise un **alias réseau** (`networks.default.aliases`) au lieu d'un `container_name`.

2. **Le réseau `coolify` est partagé entre tous les projets** d'une même instance Coolify. Tout service joint à ce réseau (typiquement le `frontend` pour être joignable par Traefik) peut résoudre les noms de services d'autres projets. Si deux projets ont un service `backend`, Docker DNS peut renvoyer le backend de l'autre projet (priorité IPv6 dans certains cas).

3. **Les variables d'environnement Coolify sont runtime par défaut.** Pour qu'elles soient disponibles pendant `docker build` (donc utilisables comme `ARG` dans le Dockerfile, et lues par `next build`), il faut explicitement cocher « Available at Buildtime ».

4. **« Domains for backend »** est une URL externe (Traefik), pas la variable `BACKEND_URL`. Ne pas confondre.

L'incident d'avril 2026 a combiné les 3 premiers points : le backend `dev-j` était bien créé mais le frontend `dev-j` résolvait `backend` vers le container du projet `beta` à cause du réseau partagé, et la variable `BACKEND_URL` corrigée n'était utilisée qu'au runtime — pas dans le `routes-manifest.json` figé au build. Tous les sign-in retournaient `INVALID_ORIGIN` parce que le backend `beta` ne reconnaissait pas l'origine `dev-j.site.devfesttoulouse.fr`.

---

## Mise à jour d'un environnement existant

Si on change la valeur de `ENV_NAME` ou `BACKEND_URL` sur un environnement existant :

1. Sauvegarder la base de données si nécessaire.
2. Modifier la variable dans Coolify, vérifier que « Available at Buildtime » est cochée pour `BACKEND_URL`.
3. **Redeploy without cache** (sinon `routes-manifest.json` n'est pas régénéré).
4. Refaire la checklist de vérifications.

## Suppression d'un environnement

1. Supprimer la ressource Coolify (les containers et volumes sont supprimés).
2. Vérifier qu'aucun container orphelin du projet ne reste : `docker ps -a | grep <hash-projet>`.
3. Supprimer la branche `dev-{initiale}` correspondante si plus utilisée.
