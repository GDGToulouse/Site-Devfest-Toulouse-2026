---
status: done
---

# Instruction: #411 backend — identité et URL de réinitialisation par rôle

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── src/backend/src/
    ├── routes/sponsor-space.ts                 ✏️ GET /api/sponsor-space/me → { id, email, name }
    ├── lib/auth.ts                             ✏️ resetUrl selon le rôle stocké (SPONSOR → /sponsor/reset-password)
    └── __tests__/sponsor-space-me.test.ts      ✅ /me authentifié et anonyme, URL de reset par rôle
```

## User Journey

```mermaid
flowchart TD
  A[Espace sponsor appelle GET /api/sponsor-space/me] --> B{Session ?}
  B -- non --> C[401]
  B -- oui --> D[id, email, name du compte connecté]
  E[Demande de mot de passe oublié] --> F{Rôle stocké}
  F -- SPONSOR --> G[Lien vers /sponsor/reset-password]
  F -- ADMIN ou EDITOR --> H[Lien vers /admin/reset-password, inchangé]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Créer un compte SPONSOR rattaché et un compte EDITOR, nodemailer mocké => comptes prêts: 5: system
  section Happy path
    GET /api/sponsor-space/me avec la clé du sponsor => 200 avec son id, son e-mail et son nom: 5: api
    POST /api/auth/request-password-reset pour le sponsor => l'e-mail contient /sponsor/reset-password: 5: api
  section Edge case - anonyme
    Sans session => GET /api/sponsor-space/me => 401: 1: api
  section Edge case - équipe
    Compte EDITOR => demander une réinitialisation => l'e-mail contient /admin/reset-password: 1: api
  section Teardown
    Supprimer les comptes et fixtures créés => base comme avant: 5: system
```

## Tasks to do

### `1)` Tests rouges

> Fixer le contrat avant de l'écrire.

1. Créer `sponsor-space-me.test.ts` sur le modèle de `sponsor-space-access.test.ts`.
2. Vérifier dans la doc better-auth (Context7) le nom de l'endpoint de demande de réinitialisation et la forme de son corps avant d'écrire le test.

### `2)` Endpoint d'identité

> Donner à l'espace sponsor la personne, pas seulement la société.

1. `GET /sponsor-space/me` à côté de `/mine` : `getAuthContext`, 401 sans session, renvoie `{ id, email, name }` seulement, sans filtre de rôle back-office.

### `3)` URL de réinitialisation

> Ne plus envoyer un sponsor vers le mur de l'admin.

1. Dans `sendResetPassword`, choisir le chemin selon `user.role` ; si le rôle n'arrive pas dans le callback, le relire en base par `user.id`.
2. Garder le texte FR actuel pour l'équipe ; texte adapté « espace partenaire » pour un sponsor.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Les tests échouent sur le code actuel (route absente, lien vers `/admin` pour un sponsor) |
| 2 | Un sponsor connecté obtient son identité ; une requête anonyme reçoit 401 |
| 3 | L'e-mail de réinitialisation d'un sponsor pointe vers `/sponsor/reset-password`, celui de l'équipe reste sur `/admin/reset-password` |
