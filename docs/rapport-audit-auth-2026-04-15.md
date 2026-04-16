# Rapport d'audit auth — 2026-04-15

**Branche** : `feature/auth-audit` (dérivée de `dev-j` au commit `97a5178`)
**Scope** : audit complet du parcours d'authentification (API + UI) en local,
puis validation sur l'environnement dev-j déployé via Coolify.

## Méthode

- API : `curl` direct sur `/api/auth/*` et `/api/admin/*`
- UI : Chrome DevTools MCP (interactions réelles)
- MailHog : récupération des emails de reset via `https://mailhog.dev-j.site.devfesttoulouse.fr`
- Comptes seedés :
  - `admin@devfesttoulouse.fr` (ADMIN, mdp `admin1234!dev` en local uniquement)
  - `editor@devfesttoulouse.fr` (EDITOR, idem)
  - `julien.delrio@gmail.com` (ADMIN, user réel sur dev-j)

## Bugs critiques détectés et corrigés dans cette branche

### Bug 1 — `forgotPassword` utilise un endpoint better-auth obsolète
- **Commit fix** : inclus dans `9896291`
- **Cause** : `admin-api.ts` appelait `/api/auth/forget-password` (endpoint v1.4)
  qui renvoie 404 sur better-auth 1.6.2. Correct : `/api/auth/request-password-reset`.
- **Effet** : le bouton "Mot de passe oublié ?" était 100 % cassé.

### Bug 2 — page `/admin/reset-password` absente
- **Commit fix** : `9896291`
- **Cause** : la page `src/frontend/src/app/admin/reset-password/page.tsx` n'existait
  pas. Le lien envoyé dans l'email tombait sur un 404.

### Bug 3 — `AdminShell` exige une session sur `/admin/reset-password`
- **Commit fix** : `9896291`
- **Cause** : un utilisateur qui a oublié son mot de passe n'a par définition
  pas de session ; `AdminShell` affichait `<AdminLogin />` par-dessus la page
  de reset, la rendant inaccessible.
- **Fix** : whitelist `PUBLIC_ADMIN_PATHS = ["/admin/reset-password"]`.

### Bug 4 — `trustedOrigins` ignorait l'URL publique
- **Commit fix** : `18c07e2`
- **Cause** : better-auth ne déclarait que `FRONTEND_URL` (interne Docker
  `http://frontend:3000`) comme origine valide. Le browser envoie pourtant
  son origin public (`https://dev-j.site.devfesttoulouse.fr`) → 403
  `INVALID_ORIGIN` sur chaque tentative de login.
- **Fix** : dériver `trustedOrigins` depuis `BASE_URL` (public) + `FRONTEND_URL`
  (interne) + un wildcard sur le root domain pour couvrir dev-j/beta/prod sans
  config par environnement.
- **Bonus** : `sendResetPassword` construit maintenant l'URL du lien email
  depuis `BASE_URL` pointant vers la page frontend `/admin/reset-password?token=…`,
  au lieu de l'URL auto-générée par better-auth qui pointait sur l'API route
  (non navigable).

### Bug 5 — `isAdminEmail()` verrouillait l'accès sur ADMIN_EMAILS à vie
- **Commit fix** : `6c9c6ef`
- **Cause** : le guard `requireAdmin` et les routes `/api/admin/session` et
  `/api/admin/profile` croisaient l'email de session avec la variable d'env
  `ADMIN_EMAILS`. Or cette variable ne doit servir **qu'au bootstrap** (pour
  créer le(s) premier(s) admin(s) via `prisma/seed.ts`). L'ajout d'admins
  ultérieurs via le back-office ne remontait pas dans cette variable, donc
  ces admins étaient rejetés en 403 malgré un rôle ADMIN en DB.
- **Fix** : la source de vérité pour l'accès back-office devient
  `user.role ∈ {ADMIN, EDITOR}` en base, avec vérif `banned=false`. Le hook
  `databaseHooks.user.create.before` continue de bloquer les sign-ups
  publics hors `ADMIN_EMAILS`, mais les invitations (via
  `routes/admin/users.ts` qui utilise `prisma.user.create` direct) ne
  déclenchent pas ce hook et ne sont donc pas affectées.

## Résultats de l'audit — ce qui marche

### API auth
| Test | Résultat |
|---|---|
| `POST /api/auth/sign-in/email` valides | 200, cookie `better-auth.session_token` HttpOnly |
| `POST /api/auth/sign-in/email` mauvais mdp | 401 `INVALID_EMAIL_OR_PASSWORD` |
| Email inconnu | 401 (même message, pas de user enumeration) |
| `POST /api/auth/sign-up/email` hors ADMIN_EMAILS | 403 "Inscription sur invitation uniquement" |
| `POST /api/auth/request-password-reset` existant | 200, token en DB, email envoyé |
| Reset unknown email | 200 (pas d'enumeration) |
| `POST /api/auth/reset-password` token valide | 200 |
| Replay du même token | 400 `INVALID_TOKEN` |
| `POST /api/auth/sign-out` avec `Origin` | 200 |

### Garde de rôle backend (`/api/admin/*`)
| Rôle | Routes accessibles | Routes refusées (403) |
|---|---|---|
| ADMIN | toutes | aucune |
| EDITOR | session, articles, pages, images, contact/messages | editions, users, tickets, settings, sponsor-plans, cache |
| anonyme | aucune | toutes |

Les write ops (POST/PUT/DELETE) sur routes ADMIN-only sont bien rejetées 403
pour EDITOR. Les routes partagées acceptent bien les write ops EDITOR (ex.
POST article → 201).

### UI navigateur
- Login admin + editor : sidebar chargée, badge correct
- Reset password full round-trip : request → email dans MailHog → lien →
  form → nouveau mdp → redirect `/admin` → re-login OK
- Sidebar filtrée par rôle : EDITOR ne voit pas Éditions / Utilisateurs /
  Paramètres
- Logout fonctionnel

### Validation sur dev-j
- `/admin`, toutes les sous-routes `/admin/*` répondent 200
- `/fr/admin`, `/en/admin` répondent 404 (admin hors `[locale]`)
- Login `julien.delrio@gmail.com` avec rôle ADMIN en DB mais **hors**
  `ADMIN_EMAILS` → accès back-office complet (validation du Bug 5)

## Anomalies identifiées (non corrigées dans cette branche)

### Anomalie 1 — pas de garde de rôle frontend sur pages ADMIN-only
**Sévérité** : moyenne (UX trompeuse, sans risque de sécurité).

Un EDITOR peut saisir `/admin/users` en URL directe : la page se charge,
le bouton "Inviter" fonctionne, le formulaire s'affiche. Si l'éditeur
soumet, l'API retourne 403 — safe, mais UX trompeur.

**Recommandation** : ajouter dans `AdminShell` un mapping `path → rôles
requis`. Si le rôle ne match pas, afficher une page "Accès refusé" plutôt
que le contenu de la route.

### Anomalie 2 — OAuth Google/GitHub potentiellement cassé
**Sévérité** : non vérifiable en local (pas de creds). Frontend pose un
`<a href>` qui fait un GET vers `/api/auth/sign-in/social` → ce handler
renvoie 404 sur GET. À valider en condition réelle quand les creds sont
fournies.

### Anomalie 3 — SMTP parfois silencieux sur dev-j
**Sévérité** : moyenne (workaround existant via reset manuel SQL).

Le `POST /api/auth/request-password-reset` retourne 200 sans toujours
envoyer le mail dans MailHog. Reproductible mais racine non identifiée :
le send SMTP direct via `nc mailhog 1025` fonctionne toujours, donc le
pipe réseau est OK. Suspects : race condition au démarrage de nodemailer,
ou `sendResetPassword` swallowed par un try/catch quelque part dans
better-auth.

**Workaround opérationnel** : générer manuellement un token de reset en
base (voir section "Cheat sheet DB" plus bas).

### Anomalie 4 — `/login` redirigé vers `/fr/login` inexistant
**Sévérité** : faible (chemin n'est pas utilisé par l'UI).

Le middleware next-intl redirige toute URL inconnue vers son équivalent
préfixé locale. Si un utilisateur tape `/login` par habitude, il tombe
sur un 404. Le vrai chemin de login est `/admin`.

**Recommandation** : ajouter un redirect `/login → /admin` dans
`next.config.ts`.

## Cheat sheet DB : reset manuel d'un password

Quand l'email de reset ne part pas, on peut insérer manuellement un token
en DB. Depuis le container `db` Postgres :

```sql
-- 1. Récupérer l'ID utilisateur
SELECT id FROM "user" WHERE email = 'julien.delrio@gmail.com';

-- 2. Insérer un token de reset (remplacer <USER_ID> et <TOKEN_SECRET>)
INSERT INTO verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt")
VALUES (
  'manual_' || substr(md5(random()::text), 1, 20),
  'reset-password:<TOKEN_SECRET>',
  '<USER_ID>',
  NOW() + INTERVAL '1 hour',
  NOW(),
  NOW()
);
```

Puis visiter `https://<domain>/admin/reset-password?token=<TOKEN_SECRET>`.

## Statut sécurité

| Aspect | État |
|---|---|
| Hash mdp (pbkdf2) | ✓ |
| Session cookie HttpOnly + SameSite=Lax | ✓ |
| Sign-up verrouillé par ADMIN_EMAILS (hook) | ✓ |
| Pas de user enumeration | ✓ |
| Token reset à usage unique + expiration 1h | ✓ |
| Rôle ADMIN vs EDITOR sur API | ✓ |
| Rôle ADMIN vs EDITOR sur UI | ✗ (Anomalie 1) |
| CSRF cross-origin sur write ops | ✓ |
| Rate limit auth | ✓ (10 req/min/IP) |
| Sign-out invalide la session | ✓ |
| Admin ajoutable via back-office sans toucher ADMIN_EMAILS | ✓ (Bug 5 fixé) |

## Commits de la branche

| SHA | Objet |
|---|---|
| `9896291` | fix: restore reset password flow (endpoint + page + AdminShell bypass) |
| `18c07e2` | fix: trust public Origin + build reset URL from BASE_URL |
| `6c9c6ef` | fix: user.role is the source of truth for back-office access |

## Conclusion

Cinq bugs critiques identifiés et corrigés, tous lié au fait que la
précédente branche d'audit auth avait été roulée en entier au reset de
dev-j, perdant ces fixes légitimes.

L'auth fonctionne maintenant de bout en bout sur dev-j. Trois anomalies
non bloquantes restent à adresser dans un futur chantier : garde de rôle
UI, OAuth à valider, SMTP intermittent.
