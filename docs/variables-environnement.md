# Variables d'environnement — Site DevFest Toulouse 2026

Ce document centralise toutes les variables d'environnement nécessaires au fonctionnement du site. Elles sont injectées par Docker Compose et lues par le service web depuis ses variables d'environnement (`process.env` ou équivalent). **Le service ne lit jamais directement un fichier `.env`.**

Un fichier `.env.example` est fourni à la racine du projet avec des valeurs fictives pour référence.

---

## Application

| Variable | Obligatoire | Description | Exemple |
|----------|:-----------:|-------------|---------|
| `NODE_ENV` | oui | Environnement d'exécution | `production` |
| `BASE_URL` | oui | URL publique du site (utilisée pour les liens emails, images OG, sitemap, liens de modification) | `https://devfesttoulouse.fr` |
| `PORT` | non | Port d'écoute du serveur (défaut : `3000`) | `3000` |

## Base de données

| Variable | Obligatoire | Description | Exemple |
|----------|:-----------:|-------------|---------|
| `DATABASE_URL` | oui | URL de connexion à la base de données | `postgresql://user:pass@db:5432/devfest` |

## Sécurité

| Variable | Obligatoire | Description | Exemple |
|----------|:-----------:|-------------|---------|
| `SESSION_SECRET` | oui | Secret pour signer les cookies et sessions. Minimum 32 caractères aléatoires. | `a1b2c3d4...` |
| `MAGIC_LINK_SECRET` | oui | Secret pour générer et vérifier les liens de modification speakers/sponsors. Distinct du `SESSION_SECRET`. | `e5f6g7h8...` |

## OAuth (Google + GitHub)

Utilisé pour l'authentification des admins (Lot 2) et des participants au passport digital (Lot 5).

| Variable | Obligatoire | Description | Exemple |
|----------|:-----------:|-------------|---------|
| `OAUTH_GOOGLE_CLIENT_ID` | oui | Client ID de l'application Google OAuth | `123456.apps.googleusercontent.com` |
| `OAUTH_GOOGLE_CLIENT_SECRET` | oui | Client Secret Google OAuth | `GOCSPX-...` |
| `OAUTH_GITHUB_CLIENT_ID` | oui | Client ID de l'application GitHub OAuth (admins uniquement) | `Iv1.abc123` |
| `OAUTH_GITHUB_CLIENT_SECRET` | oui | Client Secret GitHub OAuth | `ghp_...` |

## SMTP (envoi d'emails)

Utilisé pour le formulaire de contact (Lot 1) et l'envoi des liens de modification speakers/sponsors (Lot 2).

| Variable | Obligatoire | Description | Exemple |
|----------|:-----------:|-------------|---------|
| `SMTP_HOST` | oui | Hôte du serveur SMTP | `postfix` (container Docker) ou `localhost` |
| `SMTP_PORT` | non | Port SMTP (défaut : `25`) | `25` |
| `SMTP_FROM` | oui | Adresse expéditeur des emails | `contact@devfesttoulouse.fr` |

## API tierces

| Variable | Obligatoire | Description | Exemple |
|----------|:-----------:|-------------|---------|
| `BILLETWEB_API_KEY` | non | Clé API Billetweb pour l'import automatique des paliers de billetterie. Facultative : l'import manuel reste possible sans cette clé. | `bw_live_...` |

---

## Récapitulatif par lot

| Lot | Variables nécessaires |
|-----|----------------------|
| **Lot 1 — Fondations** | `NODE_ENV`, `BASE_URL`, `PORT`, `DATABASE_URL`, `SESSION_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `BILLETWEB_API_KEY` |
| **Lot 2 — Speakers & Sponsors** | + `MAGIC_LINK_SECRET`, `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`, `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET` |
| **Lot 3 — Programme** | aucune variable supplémentaire |
| **Lot 4 — Contenu** | aucune variable supplémentaire |
| **Lot 5 — Jour J** | aucune variable supplémentaire (OAuth Google déjà configuré au Lot 2) |

---

## Notes

- **Pas de variable pour Sessionize** : l'import est manuel (CSV/JSON) en v1. L'API Sessionize sera ajoutée ultérieurement et nécessitera une clé API supplémentaire.
- **Pas de variable pour Analytics** : le Google Analytics ID (ou équivalent) est public par nature et peut être en variable d'environnement pour varier entre environnements, mais ce n'est pas un secret. À ajouter si nécessaire.
- **Newsletter** (Lot 5) : le fournisseur n'est pas encore choisi (Mailchimp, Brevo…). Une clé API sera ajoutée à ce document une fois le choix fait.
