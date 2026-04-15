# Rapport d'audit auth — 2026-04-15

**Branche** : `feature/auth-audit` (dérivée de `dev-j` au commit `97a5178`)
**Périmètre** : test complet du parcours d'authentification (API + UI) en local
(Docker Compose), avec correctifs mineurs appliqués au fil de l'audit.

## Méthode

- API : `curl` direct sur les endpoints `/api/auth/*` et `/api/admin/*`
- UI : Chrome DevTools MCP avec interactions réelles (form fill, clicks, navigation)
- Comptes seedés : `admin@devfesttoulouse.fr` (ADMIN) et
  `editor@devfesttoulouse.fr` (EDITOR) avec mots de passe `admin1234!dev` et
  `editor1234!dev`

## Résultats — ce qui marche

### API auth
| Test | Résultat |
|---|---|
| `POST /api/auth/sign-in/email` admin valide | 200, cookie `better-auth.session_token` HttpOnly posé |
| `POST /api/auth/sign-in/email` editor valide | 200, idem |
| `POST /api/auth/sign-in/email` mauvais mot de passe | 401 `INVALID_EMAIL_OR_PASSWORD` |
| `POST /api/auth/sign-in/email` email inconnu | 401 (même message — pas de user enumeration) |
| `POST /api/auth/sign-up/email` email hors `ADMIN_EMAILS` | 403 "Inscription sur invitation uniquement" |
| `POST /api/auth/sign-up/email` email admin existant | 422 `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` |
| `POST /api/auth/request-password-reset` (existant) | 200 (token créé en DB, email envoyé via MailHog) |
| `POST /api/auth/request-password-reset` (inconnu) | 200 (pas de user enumeration) |
| `POST /api/auth/reset-password` token valide | 200 |
| `POST /api/auth/reset-password` même token rejoué | 400 `INVALID_TOKEN` |
| `POST /api/auth/sign-out` avec `Origin` | 200 (session invalidée) |
| `GET /api/auth/providers` | `{google: false, github: false}` (pas de creds en local) |

### Garde de rôle backend (`/api/admin/*`)
| Rôle | Routes accessibles | Routes refusées (403) |
|---|---|---|
| **ADMIN** | tout (session, articles, pages, images, contact/messages, editions, users, tickets, settings/*, sponsor-plans, cache/purge) | aucune |
| **EDITOR** | session, articles, pages, images, contact/messages | editions, users, tickets, settings/*, sponsor-plans, cache/purge |
| **anonymous** | aucune | tout (403 `Forbidden`) |

Vérifié pour les méthodes GET/POST/PUT/DELETE : EDITOR ne peut pas écrire sur
les routes ADMIN-only (ex. `POST /api/admin/editions`, `PUT /api/admin/settings/general`,
`POST /api/admin/cache/purge` → tous 403).

EDITOR peut bien écrire sur les routes qui lui sont ouvertes (ex. `POST /api/admin/articles` → 201).

### UI navigateur

- **Login admin** : form rempli + submit → dashboard chargé avec sidebar complète et badge "Administrateur"
- **Login editor** : form rempli + submit → dashboard chargé avec sidebar **filtrée**
  (Dashboard, Articles, Pages, Fichiers, Messages — pas d'Éditions, Utilisateurs, Paramètres)
  et badge "Éditeur"
- **Reset password full round-trip** :
  1. Click "Mot de passe oublié ?" → form email
  2. Submit email → message "Si un compte existe avec cet email, un lien a été envoyé"
  3. Email arrive dans MailHog avec `http://localhost:3000/admin/reset-password?token=...`
  4. Visite du lien → form de nouveau mot de passe (sans demande de session)
  5. Submit → message succès + redirect vers `/admin` après 1.5s
  6. Re-login avec le nouveau mot de passe → dashboard ouvert ✓
- **Logout** (bouton sidebar) → redirect vers form de login

## Bugs détectés et corrigés (cette branche)

### Bug 1 : `forgotPassword` appelle un endpoint better-auth obsolète

**Sévérité** : critique — la fonction "Mot de passe oublié" du UI était
totalement cassée.

**Cause** : [admin-api.ts:89](src/frontend/src/lib/admin-api.ts#L89) appelait
`/api/auth/forget-password` (ancien endpoint better-auth ≤ v1.4) qui retourne
404 sur la version actuelle (better-auth 1.6.2). L'API actuelle est
`/api/auth/request-password-reset`. Le fix avait été appliqué dans le chantier
auth précédent (commit `6eba860`) mais perdu lors du reset de `dev-j` à `ec050f8`.

**Correctif** : URL changée vers `/api/auth/request-password-reset`.

### Bug 2 : page `/admin/reset-password` absente

**Sévérité** : critique — le lien envoyé dans l'email de reset menait à un 404.

**Cause** : la page `src/frontend/src/app/admin/reset-password/page.tsx` n'existait
pas dans `dev-j` (elle avait été créée dans le chantier auth précédent puis
perdue lors du reset).

**Correctif** : page recréée, version French-only (cohérent avec le reste de
l'admin qui n'utilise pas i18n). Hérite du même style que `AdminLogin`.

### Bug 3 : `AdminShell` exige une session sur `/admin/reset-password`

**Sévérité** : critique — un utilisateur qui a oublié son mot de passe n'a
précisément **pas** de session, donc le AdminShell affichait le formulaire de
login au-dessus de la page de reset, rendant le reset inutilisable.

**Cause** : `AdminShell` rendait toujours `<AdminLogin />` quand `user` était
`null`, sans whitelist pour les pages publiques admin.

**Correctif** : ajout de `PUBLIC_ADMIN_PATHS = ["/admin/reset-password"]`.
Quand `pathname` matche, AdminShell rend directement `children` sans tenter
de récupérer une session.

## Anomalies identifiées (non corrigées dans cette branche)

### Anomalie 1 : pas de garde de rôle frontend sur les pages admin-only

**Sévérité** : moyenne — UX trompeuse, pas de risque de sécurité (l'API protège).

**Constat** : un EDITOR peut visiter en URL directe `/admin/users`, `/admin/editions`,
`/admin/settings`. La page se charge, le titre s'affiche, le bouton "Inviter"
fonctionne et affiche le formulaire d'invitation. Si l'éditeur soumet, l'API
retourne 403 (donc safe), mais le UX est trompeur : on lui montre une page
qu'il ne peut pas utiliser.

**Recommandation** : ajouter dans `AdminShell` un mapping `path → roles
requis`. Si le rôle ne match pas, afficher une page "Accès refusé" plutôt que
le contenu de la route. Alternative plus légère : guard côté chaque page
ADMIN-only qui vérifie `user.role === "ADMIN"` et redirige sinon.

Exemple :
```ts
const ADMIN_ONLY_PATHS = ["/admin/editions", "/admin/users", "/admin/settings", "/admin/tickets"];
const requiresAdmin = ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p));
if (requiresAdmin && user.role !== "ADMIN") {
  return <AccessDenied />;
}
```

### Anomalie 2 : `POST /api/auth/sign-out` exige `Origin` (better-auth v1.6)

**Sévérité** : faible (comportement attendu de better-auth, juste à connaître).

**Constat** : un appel curl sans header `Origin` reçoit 403 `MISSING_OR_NULL_ORIGIN`.
Les navigateurs envoient toujours `Origin` sur les fetch, donc l'UI marche.
Anomalie cosmétique pour les tests CLI.

### Anomalie 3 : `sign-in/email` n'exige pas `Origin`, contrairement à `sign-out`

**Sévérité** : faible — incohérence interne better-auth, hors de notre contrôle.

### Anomalie 4 : flux OAuth probablement cassé (à valider quand creds fournies)

**Sévérité** : moyenne — non vérifiable en local sans creds Google/GitHub.

**Constat** : le frontend pose un `<a href={getAuthUrl(...)}>` qui fait un GET
vers `/api/auth/sign-in/social?provider=...`. Or la documentation better-auth
suggère que cet endpoint attend un POST. Test direct :
- `GET /api/auth/sign-in/social?provider=google&callbackURL=/admin` → 404 `null`
- `POST /api/auth/sign-in/social` `{provider:"google",callbackURL:"/admin"}` → 500 (creds manquantes, mais accepte le POST)

À valider en condition réelle dès que les creds sont en place sur dev-j.
Si confirmé, remplacer le lien par un formulaire/handler qui POST.

## Statut sécurité global

| Aspect | État |
|---|---|
| Mot de passe haché (better-auth pbkdf2) | ✓ |
| Session cookie HttpOnly + SameSite=Lax | ✓ |
| Inscription verrouillée par ALLOWLIST `ADMIN_EMAILS` | ✓ |
| Pas de user enumeration (login + reset) | ✓ |
| Token de reset à usage unique | ✓ |
| Token de reset avec expiration (1h) | ✓ |
| Garde de rôle ADMIN vs EDITOR sur l'API | ✓ |
| Garde de rôle ADMIN vs EDITOR sur le UI | ✗ (Anomalie 1) |
| CSRF cross-origin sur write ops | ✓ (rejet `MISSING_OR_NULL_ORIGIN`) |
| Rate limit `/api/auth/*` | ✓ (10 req/min/IP, configuré dans backend index.ts) |

## Conclusion

Auth fonctionne après fix des 3 bugs critiques liés au reset password (endpoint
backend, page frontend, bypass AdminShell). Le contrôle de rôle backend est
solide. Le seul manque réel est le contrôle de rôle côté UI (anomalie 1) —
peu grave en sécurité mais à fixer pour l'UX.

OAuth à retester en condition réelle.
