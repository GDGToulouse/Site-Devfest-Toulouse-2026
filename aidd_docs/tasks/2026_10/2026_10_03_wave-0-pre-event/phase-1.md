---
status: done
---

# Instruction: Audit des rôles stockés en prod et en beta (#500, tâche 1)

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── (aucun fichier : lecture de la base prod et beta sur le VPS, résultat consigné en commentaire de #500)
```

## User Journey

```mermaid
flowchart TD
  A[SSH sur le VPS] --> B[Identifier le conteneur db prod puis beta par BASE_URL]
  B --> C[select role, count par role]
  C --> D[Lister les comptes EDITOR et ADMIN avec leur e-mail]
  D --> E{Un compte est-il un contact sponsor ?}
  E -- non --> F[Consigner « aucun défaut » sur #500]
  E -- oui --> G[Repasser le compte en SPONSOR, avec accord de Julien]
  G --> H[Consigner le compte corrigé sans e-mail en clair sur #500]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Identifier le conteneur db par le BASE_URL du backend => nom du conteneur affiché et relu: 5: cli
  section Happy path
    Compter les comptes par rôle => répartition ADMIN EDITOR SPONSOR affichée: 5: cli
    Croiser les comptes EDITOR avec SponsorContact.userId => zéro ligne: 5: cli
  section Edge case - contact sponsor en EDITOR
    Un contact sponsor porte EDITOR => passer son rôle à SPONSOR => la requête de croisement renvoie zéro ligne: 1: cli
```

## Tasks to do

### `1)` Identifier les bases

> Viser la bonne base : les hashes Coolify changent à chaque redéploiement.

0. Julien exécute toutes les commandes de cette phase ; l'agent ne se connecte jamais au VPS (`CLAUDE.md`), il les prépare et lit les résultats.
1. Détecter le conteneur `backend-*` dont `BASE_URL` vaut `https://devfesttoulouse.fr`, en déduire `db-<hash>` ; idem pour `https://beta.site.devfesttoulouse.fr`.
2. Afficher les deux noms et les relire avant toute requête.

### `2)` Lire les rôles

> Savoir si un compte tiers a le back-office.

1. `select role, count(*) from "user" group by role;` sur chaque base.
2. `select u.email, u.role from "user" u join "SponsorContact" sc on sc."userId" = u.id where u.role <> 'SPONSOR';` (`User` est mappé sur `"user"`, `SponsorContact` n'a pas de `@@map`).
3. Comparer la liste des comptes `ADMIN`/`EDITOR` aux membres de l'équipe et à `ADMIN_EMAILS`.

### `3)` Corriger si besoin

> Fermer l'accès sans attendre le correctif de code.

1. Présenter à Julien chaque compte fautif ; n'écrire qu'après son accord.
2. `update "user" set role = 'SPONSOR' where id = '<id>';`, puis relancer la requête de croisement.

### `4)` Consigner

> Laisser la trace sur l'issue, sans donnée personnelle.

1. Commentaire sur #500 : répartition par rôle par environnement, nombre de comptes corrigés, sans e-mail.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Les deux conteneurs interrogés sont ceux de prod et de beta, identifiés par leur `BASE_URL` |
| 2 | La répartition des rôles de chaque base est connue, et chaque compte `ADMIN`/`EDITOR` est rattaché à un membre de l'équipe |
| 3 | Aucun compte lié à un `SponsorContact` ne porte `ADMIN` ou `EDITOR` |
| 4 | #500 porte un commentaire qui donne le résultat par environnement, sans adresse e-mail |
