# Variables d'environnement — Site DevFest Toulouse 2026

Ce document centralise toutes les variables d'environnement nécessaires au fonctionnement du site. Elles sont injectées par Docker Compose et lues par chaque service depuis ses variables d'environnement (`process.env`). **Les services ne lisent jamais directement un fichier `.env`.**

Un fichier `.env.example` est fourni à la racine du projet avec des valeurs fictives pour référence.

---

## Frontend (Next.js)

| Variable | Obligatoire | Description | Exemple |
|----------|:-----------:|-------------|---------|
| `NODE_ENV` | oui | Environnement d'exécution | `production` |
| `BASE_URL` | oui | URL publique du site (utilisée pour les images OG, sitemap, canonical) | `https://devfesttoulouse.fr` |
| `BACKEND_URL` | oui | URL interne du backend (réseau Docker) | `http://backend:4000` |
| `PORT` | non | Port d'écoute du frontend (défaut : `3000`) | `3000` |
| `NEXT_PUBLIC_PLAUSIBLE_SRC` | non | URL du script Plausible (depuis le dashboard Plausible, active le tracking si défini) | `https://plausible.example.com/js/pa-XXXXX.js` |

## Backend (API)

| Variable | Obligatoire | Description | Exemple |
|----------|:-----------:|-------------|---------|
| `NODE_ENV` | oui | Environnement d'exécution | `production` |
| `BASE_URL` | oui | URL publique du site (utilisée pour les liens emails, liens de modification) | `https://devfesttoulouse.fr` |
| `PORT` | non | Port d'écoute du backend (défaut : `4000`) | `4000` |
| `LOG_LEVEL` | non | Niveau du logger Pino/Fastify (`fatal\|error\|warn\|info\|debug\|trace`). Défaut `info`. Passer à `debug` pour activer les traces verbeuses (auth guards, proxy, etc.) lors d'un diagnostic. | `debug` |
| `SWAGGER_PUBLIC` | non | `true` pour exposer la doc OpenAPI sur `/api/docs` en production. Défaut désactivé en prod, activé en dev. | `false` |
| `REVALIDATE_SECRET` | oui en prod | Secret partagé entre backend et frontend pour invalider le cache Next via `POST /api/revalidate`. Si absent, la revalidation est désactivée (le cache reste statique jusqu'au TTL `s-maxage`). | (32+ caractères aléatoires) |
| `BROCHURE_TOKEN_SECRET` | oui en prod | Secret HMAC utilisé pour signer les liens de téléchargement de la plaquette envoyés par email. Si absent, le mail de confirmation tombe sur l'URL brute (sans tracking). | (32+ caractères aléatoires) |
| `GEMINI_API_KEY` | non (mais requise pour la traduction IA) | Clé API Google Gemini utilisée par la fonctionnalité de traduction FR⇄EN du back-office. Si absente, l'endpoint `/api/admin/translate` répond `503 not_configured` et le bouton « Traduire » est désactivé côté UI. **Free tier** : données potentiellement utilisées pour l'entraînement — ne pas activer sur du contenu confidentiel. Migrer vers Tier 1 payant si besoin. Obtenir une clé : https://aistudio.google.com/apikey | `AIzaSy...` |
| `ENV_NAME` | non | Nom de l'environnement de déploiement. Sert à l'aliasing réseau Docker **et** est exposé dans l'admin via `GET /api/health` → badge `v{version} · {environment}` dans la sidebar (#171). Défaut `local` (`dev` dans `docker-compose.dev.yml`). Hors `local`, `seed-dev.ts` exige `DEV_SEED_PASSWORD`. | `beta`, `prod` |
| `DEV_SEED_PASSWORD` | oui sur `dev-j` | Mot de passe posé par `seed-dev.ts` sur les comptes de démo (ADMIN, EDITOR, sponsors), au lieu des mots de passe publics de `docs/comptes-dev-local.md`. 12 caractères minimum. Sans elle, sur un environnement dont `ENV_NAME` n'est pas `local`, le seed échoue et le backend ne démarre pas. Inutile en local et en CI. | (20+ caractères aléatoires) |
| `APP_VERSION` | non | Surcharge le numéro de version applicatif (semver) exposé par `GET /api/health`. Par défaut, la constante `APP_VERSION` du code (`1.0.0`), incrémentée à la main à chaque release et taguée sur `main`. | `1.0.0` |

## Base de données (backend uniquement)

| Variable | Obligatoire | Description | Exemple |
|----------|:-----------:|-------------|---------|
| `DATABASE_URL` | oui | URL de connexion à la base de données | `postgresql://user:pass@db:5432/devfest` |

## Sécurité (backend uniquement)

| Variable | Obligatoire | Description | Exemple |
|----------|:-----------:|-------------|---------|
| `SESSION_SECRET` | oui | Secret pour signer les cookies et sessions. Minimum 32 caractères aléatoires. Hors local (`NODE_ENV=production` ou `ENV_NAME` autre que `local`), le backend refuse de démarrer s'il manque ou s'il vaut encore un exemple `change-me…` ; même refus pour `MAGIC_LINK_SECRET`, `REVALIDATE_SECRET`, `BROCHURE_TOKEN_SECRET` et `TRASH_PURGE_SECRET` laissés à leur exemple. | `a1b2c3d4...` |
| `TRUST_PROXY_HOPS` | non | Nombre de proxys inverses entre le visiteur et le backend (#663). Le backend lit `request.ip` (limites de débit, historique) dans `X-Forwarded-For` en remontant ce nombre de sauts depuis la socket ; ce que le visiteur écrit plus à gauche ne compte pas. **Chaîne déployée (dev-j, beta, prod) : navigateur → Traefik → frontend Next → backend, donc `1`** (valeur par défaut des composes `prod` et `dev`) : Traefik remplace l'en-tête par l'adresse du visiteur, Next le transmet tel quel, le seul saut de confiance est le conteneur frontend. **Local : `0`** (pas de Traefik). Vide ou `0` : aucune confiance, `request.ip` est la socket. Un saut ne compte que s'il a une adresse privée ou de loopback. Une valeur qui n'est pas un entier ≥ 0 empêche le démarrage. Trop bas, tous les visiteurs partagent un compteur ; trop haut, un visiteur choisit son adresse. | `1` |
| `MAGIC_LINK_SECRET` | oui | Secret pour générer et vérifier les liens de modification speakers/sponsors. Distinct du `SESSION_SECRET`. | `e5f6g7h8...` |
| `TRASH_PURGE_SECRET` | non | Secret partagé permettant de déclencher **à la main** la purge de corbeille sans session (en-tête `X-Purge-Secret`). Facultatif : la purge quotidienne est une tâche du backend et ne l'utilise pas. **Sans cette variable, l'endpoint n'accepte qu'une session ADMIN.** | (32+ caractères aléatoires) |
| `TRASH_RETENTION_DAYS` | non | Délai de conservation en corbeille avant purge définitive. Défaut **30**. Une valeur invalide ou `< 1` retombe sur 30 : une faute de frappe ne doit pas vider la corbeille. | `30` |

## OAuth — Google + GitHub (backend uniquement)

Utilisé pour l'authentification des admins (Lot 2) et des participants au passport digital (Lot 5).

| Variable | Obligatoire | Description | Exemple |
|----------|:-----------:|-------------|---------|
| `OAUTH_GOOGLE_CLIENT_ID` | oui | Client ID de l'application Google OAuth | `123456.apps.googleusercontent.com` |
| `OAUTH_GOOGLE_CLIENT_SECRET` | oui | Client Secret Google OAuth | `GOCSPX-...` |
| `OAUTH_GITHUB_CLIENT_ID` | oui | Client ID de l'application GitHub OAuth (admins uniquement) | `Iv1.abc123` |
| `OAUTH_GITHUB_CLIENT_SECRET` | oui | Client Secret GitHub OAuth | `ghp_...` |

## SMTP — envoi d'emails (backend uniquement)

Utilisé pour le formulaire de contact (Lot 1) et l'envoi des liens de modification speakers/sponsors (Lot 2).

### Variables disponibles

| Variable | Obligatoire | Description | Défaut |
|----------|:-----------:|-------------|--------|
| `SMTP_HOST` | oui | Hôte du serveur SMTP. | `localhost` |
| `SMTP_PORT` | non | Port SMTP. | `1025` |
| `SMTP_SECURE` | non | `true` pour forcer TLS au handshake (port 465). | `false` |
| `SMTP_AUTH` | non | `true` pour activer l'auth SMTP via `SMTP_USER` / `SMTP_PASSWORD`. | `false` |
| `SMTP_USER` | si `SMTP_AUTH=true` | Identifiant SMTP | — |
| `SMTP_PASSWORD` | si `SMTP_AUTH=true` | Mot de passe SMTP | — |
| `SMTP_FROM` | oui | Adresse expéditeur des emails | `contact@devfesttoulouse.fr` |

### Profil par environnement

| Environnement | Compose file | SMTP_HOST | SMTP_PORT | SMTP_SECURE | SMTP_AUTH | Émission réelle ? |
|---|---|---|---|---|---|---|
| **Local / dev-j** | `docker-compose.local.yml` / `docker-compose.dev.yml` | `mailhog` | `1025` | `false` | `false` | ❌ Capturés par MailHog (UI sur `:8025`, protégée par mot de passe sur dev-j) |
| **Beta / Prod** | `docker-compose.prod.yml` | `postfix` | `25` | `false` | `false` | ✅ Vrais emails via le service Postfix standalone Coolify |

> ⚠️ **Beta / Prod** : le service `postfix` n'est plus défini dans `docker-compose.prod.yml`. Il est désormais déployé en **service standalone Coolify** au niveau de l'instance, partagé par tous les projets. Le backend joint le réseau `coolify` (configuré dans `docker-compose.prod.yml`) pour résoudre l'hostname `postfix`.

### MailHog sur dev-j

| Variable | Obligatoire | Description | Exemple |
|----------|:-----------:|-------------|---------|
| `MAILHOG_USER` | oui sur `dev-j` | Identifiant de l'authentification HTTP de l'interface et de l'API MailHog. | `julien` |
| `MAILHOG_PASSWORD` | oui sur `dev-j` | Mot de passe en clair : MailHog le hache lui-même (bcrypt) au démarrage. Sans ces deux variables, le conteneur MailHog refuse de démarrer. Le SMTP (port 1025) reste ouvert au backend. Le compose local garde MailHog sans authentification. | (20+ caractères aléatoires) |

> ⚠️ **Local / dev-j** : ne **pas** ajouter `SMTP_HOST=postfix` dans Coolify dev-j — la variable d'env n'a pas besoin d'être renseignée, le compose impose déjà `mailhog` pour ces environnements. La modifier casserait le flow MailHog.

## API tierces (backend uniquement)

| Variable | Obligatoire | Description | Exemple |
|----------|:-----------:|-------------|---------|
| `BILLETWEB_USER` | non | Identifiant utilisateur API Billetweb (email du compte). Facultatif : l'import manuel des tarifs reste possible sans. | `contact@devfesttoulouse.fr` |
| `BILLETWEB_KEY` | non | Clé API Billetweb (générée dans le back-office Billetweb > API). | `abc123def456...` |

---

## Récapitulatif par lot et par service

### Frontend

| Lot | Variables nécessaires |
|-----|----------------------|
| **Tous les lots** | `NODE_ENV`, `BASE_URL`, `BACKEND_URL`, `PORT` |

### Backend

| Lot | Variables nécessaires |
|-----|----------------------|
| **Lot 1 — Fondations** | `NODE_ENV`, `BASE_URL`, `PORT`, `DATABASE_URL`, `SESSION_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `BILLETWEB_USER`, `BILLETWEB_KEY` |
| **Lot 2 — Speakers & Sponsors** | + `MAGIC_LINK_SECRET`, `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`, `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET` |
| **Lot 3 — Programme** | aucune variable supplémentaire |
| **Lot 4 — Contenu** | aucune variable supplémentaire |
| **Lot 5 — Jour J** | aucune variable supplémentaire (OAuth Google déjà configuré au Lot 2) |

---

## Tâche planifiée — purge de la corbeille (#149, #664)

Supprimer un élément depuis l'admin le place en **corbeille** : la ligne survit,
masquée de l'admin comme du site public, et reste restaurable. Au-delà du délai
de conservation (`TRASH_RETENTION_DAYS`, 30 jours par défaut), elle est
détruite pour de bon — ainsi que les fichiers qu'elle était seule à utiliser.

**La purge tourne toute seule**, chaque jour à 4 h (heure de Paris), dans une
tâche `node-cron` du backend (`src/backend/src/lib/scheduler.ts`). Rien à créer
dans Coolify, aucun secret à poser. Un échec est écrit dans les logs
(`Trash purge failed`) et la purge réessaie le lendemain ; un succès aussi
(`Trash purged`, avec le nombre de lignes détruites).

Elle apparaît dans l'historique comme une action du **système**, acteur
« Purge de la corbeille ».

Deux limites tant que le backend a un seul réplica : un redéploiement à 4 h
saute la purge du jour (la suivante rattrape), et à plusieurs réplicas chacun la
lancerait — sans danger, la purge est idempotente.

### Déclenchement manuel

Utile pour vérifier ce qu'une prochaine purge détruirait, ou pour vider tout de
suite. Depuis le conteneur backend, avec `TRASH_PURGE_SECRET` posé :

```bash
# Ce que la prochaine purge détruirait — sans effet de bord, ne fait que lire
curl -fsS http://localhost:4000/api/maintenance/purge-trash \
  -H "X-Purge-Secret: $TRASH_PURGE_SECRET"
# → {"retentionDays":30,"cutoff":"2026-06-20T…"}

# Purger maintenant
curl -fsS -X POST http://localhost:4000/api/maintenance/purge-trash \
  -H "X-Purge-Secret: $TRASH_PURGE_SECRET"
```

Sans secret, une **session ADMIN** déclenche la même purge depuis le back-office.
Le secret (`openssl rand -hex 32`) se pose en variable d'exécution du backend,
**pas** « Available at Buildtime ».

### Ce que renvoie la purge

```json
{
  "cutoff": "2026-06-20T04:00:00.000Z",
  "retentionDays": 30,
  "totalPurged": 3,
  "entities": [{ "entity": "articles", "purged": 3, "filesDeleted": 1, "filesKept": 2 }]
}
```

`filesKept` compte les fichiers **conservés parce qu'un autre élément les
utilise encore** : les uploads sont une bibliothèque partagée, purger une ligne
ne doit pas casser l'illustration d'une autre.

### Garde-fous

- **Idempotente** : relancée, elle ne trouve plus rien (`purged: 0`). Un cron qui
  se déclenche deux fois, ou qui rejoue après un timeout, est sans danger.
- **Sans secret configuré**, l'endpoint n'accepte qu'une **session ADMIN** : rien
  ne s'ouvre. La purge quotidienne n'en dépend pas.
- **Un EDITOR ne peut pas** déclencher la purge, même connecté.
- Les éléments **vivants** ne sont jamais touchés, quel que soit le délai.

---

## Notes

- **Pas de variable pour Sessionize** : l'import est manuel (CSV/JSON) en v1. L'API Sessionize sera ajoutée ultérieurement et nécessitera une clé API supplémentaire.
- **Pas de variable pour Analytics** : le Google Analytics ID (ou équivalent) est public par nature et peut être en variable d'environnement pour varier entre environnements, mais ce n'est pas un secret. À ajouter si nécessaire.
- **Newsletter** (Lot 5) : le fournisseur n'est pas encore choisi (Mailchimp, Brevo…). Une clé API sera ajoutée à ce document une fois le choix fait.
