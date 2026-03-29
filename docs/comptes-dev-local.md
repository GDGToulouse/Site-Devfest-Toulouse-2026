# Comptes de test — Développement local uniquement

> **ATTENTION** : ces comptes sont exclusivement destinés au développement local (`docker compose up`). Ne jamais utiliser ces identifiants en production ou sur un environnement accessible publiquement.

## Comptes provisionnés par le seed

| Rôle | Email | Usage |
|------|-------|-------|
| ADMIN | `admin@devfesttoulouse.fr` | Accès complet au back-office |
| EDITOR | `editor@devfesttoulouse.fr` | Rédaction d'articles et pages |

## Configuration

Les emails sont inclus dans `ADMIN_EMAILS` par défaut dans `docker-compose.yml` :

```
ADMIN_EMAILS=admin@devfesttoulouse.fr,editor@devfesttoulouse.fr
```

Les comptes sont créés dans la table `User` par `prisma/seed.ts`.

## Première connexion (mot de passe local)

1. Lancer `docker compose up`
2. Aller sur http://localhost:3000/fr/admin
3. Cliquer **« Mot de passe oublié ? »**
4. Entrer l'email du compte (ex. `admin@devfesttoulouse.fr`)
5. Ouvrir MailHog : http://localhost:8025
6. Cliquer sur le lien de réinitialisation dans l'email reçu
7. Définir un mot de passe (minimum 10 caractères)
8. Se connecter avec email + mot de passe

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
