# Comptes de test — Développement local uniquement

> **ATTENTION** : ces comptes sont exclusivement destinés au développement local (`docker compose up`). Ne jamais utiliser ces identifiants en production ou sur un environnement accessible publiquement.

## Comptes provisionnés par le seed

| Rôle | Email | Mot de passe | Usage |
|------|-------|-------------|-------|
| ADMIN | `admin@devfesttoulouse.fr` | `admin1234!dev` | Accès complet au back-office |
| EDITOR | `editor@devfesttoulouse.fr` | `editor1234!dev` | Rédaction d'articles et pages |

## Configuration

Les emails sont inclus dans `ADMIN_EMAILS` par défaut dans `docker-compose.yml` :

```
ADMIN_EMAILS=admin@devfesttoulouse.fr,editor@devfesttoulouse.fr
```

Les comptes sont créés dans la table `User` par `prisma/seed.ts`.

## Seed

Le seed de développement **n'est pas exécuté automatiquement** au démarrage. Il faut le lancer manuellement :

```bash
docker compose -f docker-compose.local.yml exec backend pnpm exec tsx prisma/seed-dev.ts
```

Cela crée les comptes de test, les éditions, les articles, les tarifs et les chiffres clés de démo.

> **Note** : le seed de base (`prisma/seed.ts`) est exécuté automatiquement à chaque démarrage du container backend (en dev comme en prod). Il crée uniquement les catégories de contact et les comptes admin à partir de `ADMIN_EMAILS` — il est idempotent et ne recrée rien si les données existent déjà.

## Connexion

1. Lancer `docker compose -f docker-compose.local.yml up`
2. Lancer le seed dev si c'est la première fois (voir ci-dessus)
3. Aller sur http://localhost:3000/fr/admin
4. Entrer l'email et le mot de passe du tableau ci-dessus
5. Cliquer **« Se connecter »**

> Si les mots de passe n'ont pas pu être provisionnés par le seed (tables Better Auth pas encore créées), utiliser le flow **« Mot de passe oublié ? »** → MailHog (http://localhost:8025) pour en définir un.

## Première connexion (OAuth)

Si vous avez configuré les credentials OAuth dans `.env` :

1. Aller sur http://localhost:3000/fr/admin
2. Cliquer **Google** ou **GitHub**
3. Se connecter avec un compte dont l'email correspond à un des emails autorisés

## MailHog

Tous les emails (vérification, réinitialisation) sont capturés par MailHog :

- Interface web : http://localhost:8025
- SMTP : `localhost:1025`

## Réinitialisation complète

Pour repartir de zéro (supprime toutes les données) :

```bash
docker compose -f docker-compose.local.yml down -v
docker compose -f docker-compose.local.yml up -d
docker compose -f docker-compose.local.yml exec backend pnpm exec tsx prisma/seed-dev.ts
```

Le seed de base est exécuté automatiquement au démarrage. Le seed dev doit être relancé manuellement pour recréer les données de test.
