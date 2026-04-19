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

## Base de données (backend uniquement)

| Variable | Obligatoire | Description | Exemple |
|----------|:-----------:|-------------|---------|
| `DATABASE_URL` | oui | URL de connexion à la base de données | `postgresql://user:pass@db:5432/devfest` |

## Sécurité (backend uniquement)

| Variable | Obligatoire | Description | Exemple |
|----------|:-----------:|-------------|---------|
| `SESSION_SECRET` | oui | Secret pour signer les cookies et sessions. Minimum 32 caractères aléatoires. | `a1b2c3d4...` |
| `MAGIC_LINK_SECRET` | oui | Secret pour générer et vérifier les liens de modification speakers/sponsors. Distinct du `SESSION_SECRET`. | `e5f6g7h8...` |

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
| **Local / dev-j** | `docker-compose.dev.yml` | `mailhog` | `1025` | `false` | `false` | ❌ Capturés par MailHog (UI sur `:8025`) |
| **Beta / Prod** | `docker-compose.prod.yml` | `postfix` | `25` | `false` | `false` | ✅ Vrais emails via le service Postfix standalone Coolify |

> ⚠️ **Beta / Prod** : le service `postfix` n'est plus défini dans `docker-compose.prod.yml`. Il est désormais déployé en **service standalone Coolify** au niveau de l'instance, partagé par tous les projets. Le backend joint le réseau `coolify` (configuré dans `docker-compose.prod.yml`) pour résoudre l'hostname `postfix`.

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

## Notes

- **Pas de variable pour Sessionize** : l'import est manuel (CSV/JSON) en v1. L'API Sessionize sera ajoutée ultérieurement et nécessitera une clé API supplémentaire.
- **Pas de variable pour Analytics** : le Google Analytics ID (ou équivalent) est public par nature et peut être en variable d'environnement pour varier entre environnements, mais ce n'est pas un secret. À ajouter si nécessaire.
- **Newsletter** (Lot 5) : le fournisseur n'est pas encore choisi (Mailchimp, Brevo…). Une clé API sera ajoutée à ce document une fois le choix fait.
