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

## Connexion

1. Lancer `docker compose up`
2. Aller sur http://localhost:3000/fr/admin
3. Entrer l'email et le mot de passe du tableau ci-dessus
4. Cliquer **« Se connecter »**

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
docker compose down -v
docker compose up
```

Le seed recréera les comptes et les données de test.
