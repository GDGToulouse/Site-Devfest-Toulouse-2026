# Rapport — chantier auth/admin mis en pause

**Date** : 2026-04-15
**Branche de référence** : `wip/auth-admin-refactor` (sauvegarde sur origin)
**Branche `dev-j`** : remise à `ec050f8` (avant tout le chantier)

## Contexte

Un chantier de 16 commits sur `dev-j` a été entamé pour :
1. Faire fonctionner le reset password avec better-auth v1.6 derrière un reverse proxy (Traefik/Coolify)
2. Durcir la sécurité auth (CSRF, cookies) suite à un audit
3. Sortir l'admin du segment i18n `[locale]/admin` car mono-langue

Le déploiement Coolify échoue sur un bug Next.js 16 (`_global-error` prerender
`useContext null`) — bug **pré-existant**, indépendant de ce chantier. Ce
bug nécessite une investigation séparée (downgrade Next ? patch upstream ?
config `cacheComponents` ?) et bloque tout push sur `dev-j` tant qu'il n'est
pas résolu.

Pour éviter de traîner ce chantier en l'état, `dev-j` a été remis à
`ec050f8` (dernier commit sain avant chantier). Le travail fait est
conservé sur la branche `wip/auth-admin-refactor`.

## Décision à prendre

Ne pas cherry-picker les commits — leurs messages et diffs portent la trace
du contexte de debug (CSRF désactivé, logs de tokens, tentatives de
workaround). **Ré-implémenter proprement** les parties non liées à l'auth.

## Ce qu'il y a à ré-implémenter (non-auth)

### 1. `.gitignore` — ajout de la lockfile Claude Code

Une ligne :
```
.claude/scheduled_tasks.lock
```

Trivial. Commit `chore:` à part.

### 2. Refactor : sortir l'admin de `[locale]`

Décision de design indépendante de l'auth : le back-office admin est
mono-langue (français uniquement, cohérent avec le reste des pages admin
qui n'utilisent pas `useTranslations`). Le sortir de `[locale]/admin` a
trois bénéfices :

1. **Élimine un 404 en dev** : Next.js 16 dev-server rend `/fr/admin` mais
   renvoie 404 sur `/fr/admin/articles` en accès direct URL (SPA nav OK).
   Hors `[locale]`, `/admin/articles` répond correctement.
2. **Supprime des hacks** : 4 pages admin font
   `const locale = pathname.startsWith("/en") ? "en" : "fr"` uniquement pour
   reconstruire des URLs admin. Devient inutile.
3. **Simplifie les URLs côté backend** : le backend construit actuellement
   des URLs hardcodées `${frontendUrl}/fr/admin/...` pour le reset password
   et les emails d'invitation.

#### Étapes concrètes (à refaire depuis le code actuel, pas un cherry-pick)

| Fichier | Changement |
|---|---|
| `src/frontend/src/app/[locale]/admin/*` → `src/frontend/src/app/admin/*` | `git mv` (13 pages + `layout.tsx`) |
| `src/frontend/src/middleware.ts` | Matcher : ajouter `admin` à la liste d'exclusion |
| `src/frontend/next.config.ts` | Cache header `Cache-Control: no-store` : `/:locale(fr|en)/admin/:path*` → `/admin/:path*` |
| `src/frontend/src/components/admin/AdminSidebar.tsx` | Retirer `const locale = ...` et les `${locale}` des href ; `/` au lieu de `/${locale}` pour "Voir le site" |
| `src/frontend/src/app/admin/articles/page.tsx` | Retirer `const locale` → href statiques `/admin/articles/:id`. **Garder** `locale` pour les liens "Prévisualiser" vers `/${locale}/actualites/...` |
| `src/frontend/src/app/admin/articles/[id]/page.tsx` | Retirer `usePathname` / `locale`, `router.push('/admin/articles')` |
| `src/frontend/src/app/admin/editions/page.tsx` | Idem |
| `src/frontend/src/app/admin/editions/[id]/page.tsx` | Idem |
| `src/frontend/src/lib/admin-api.ts` | `callbackURL` OAuth : `/fr/admin` → `/admin` |
| `src/backend/src/lib/auth.ts` | URL de reset password : `${frontendPublicUrl}/admin/reset-password?token=...` (sans `/fr`) |
| `src/backend/src/routes/admin/users.ts` | URL d'invitation dans email : `${BASE_URL}/admin` (sans `/fr`) |

**Note importante** : sur `ec050f8` actuel, la page
`src/frontend/src/app/[locale]/admin/reset-password/page.tsx` **n'existe
pas encore** — elle a été ajoutée par le chantier auth. Si le refactor est
appliqué avant que le reset password soit rejoué, il n'y a simplement pas
cette page à traiter dans le move.

#### Estimation

~18 fichiers touchés, ~40 lignes net de diff. Un seul commit
`refactor(admin): move admin out of [locale] segment`. Effort : 30-45 min
avec test browser.

## Ce qui est délibérément laissé de côté

### Le chantier auth complet

Tous les fixes auth (6eba860 c4027d4 5254413 6fe84ea 5886815 00d41b5
410ecd8 f46d796 9432521 2543002 9e9fcc1 588daab 4c5609a bd032c0 30b63bc)
sont conservés sur `wip/auth-admin-refactor` pour référence mais **ne
seront pas ré-appliqués en l'état**. Le rapport d'audit auth
([docs/rapport-corrections-auth.md](docs/rapport-corrections-auth.md) sur
la branche wip) reste valable. Plusieurs de ces commits contiennent :

- Des **contournements** à re-designer : `disableOriginCheck: true`,
  `disableCSRFCheck: true`, URL de reset construite côté backend pour
  bypasser la validation `redirectTo` de better-auth
- Des **logs de debug** qui exposent potentiellement des tokens
- Des **fixes fonctionnels** qu'il faudra reprendre (endpoint renommé
  `/request-password-reset`, page reset password, bypass AdminShell)

À reprendre dans un chantier séparé **une fois** le bug Coolify/Next.js 16
résolu, avec une approche propre (pas 15 commits de debug successifs).

### Le bump Next.js 16.2.1 → 16.2.3

Tenté puis abandonné : même bug `_global-error` sur les deux versions.
Passage à Next 15.5.15 testé également — échec car `Google Sans` via
`next/font/google` n'est supporté qu'en Next 16.

## Références

- Branche de sauvegarde complète : `origin/wip/auth-admin-refactor`
- Rapport d'audit auth : dans cette branche, `docs/rapport-corrections-auth.md`
- Log Coolify du dernier échec de build : conversation du 2026-04-14
- Commits datés du chantier :
  - Début : `6eba860` (fix endpoint better-auth v1.5+)
  - Fin : `183c897` (refactor admin hors [locale])
