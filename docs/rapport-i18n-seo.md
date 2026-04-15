# Rapport — revue i18n / SEO

**Date** : 2026-04-15
**Branche** : `dev-j` (`a1ca04b`)
**Scope** : frontend Next.js `src/frontend/` + contrats backend qui construisent des URLs publiques

## Objectif cible

> Seules les pages destinées à être référencées par les moteurs de
> recherche ont un préfixe de langue dans l'URL (`/fr/...`, `/en/...`).
> Les autres pages (admin, utilitaires, 404 racine) sont servies sur une
> URL unique sans préfixe ; la langue d'affichage est choisie côté client
> selon les préférences du navigateur.

Cette règle a deux conséquences directes :
- l'admin et les pages de service n'ont **pas** à vivre sous `/[locale]/…`
- Google doit voir **une URL canonique par langue** pour le contenu
  indexable, avec `hreflang` qui relie `/fr/x`, `/en/x` et `x-default`

Ce rapport est un plan d'action. Aucune correction n'est encore appliquée.

## Classement des pages actuelles

### À garder sous `[locale]` (indexables)

Toutes les pages publiques vivant déjà sous `src/frontend/src/app/[locale]/*`
sauf `admin` : accueil, `actualites` (liste + slug + tags), `editions/[year]`,
`contact`, `billetterie`, `devenir-sponsor`, `proposer-un-talk`,
`code-de-conduite`, `mentions-legales`, plus le `not-found.tsx` local.

**État actuel : OK** — elles sont sous `[locale]`, ont un
`generateMetadata` avec `alternates.canonical` + `alternates.languages`
(vérifié sur [actualites/page.tsx](src/frontend/src/app/[locale]/actualites/page.tsx)).

### À sortir du préfixe de langue (non indexables)

1. **Admin** — 14 pages sous
   [src/frontend/src/app/[locale]/admin/](src/frontend/src/app/[locale]/admin/)
   (`admin/page`, `admin/articles`, `admin/articles/[id]`, `admin/editions`,
   `admin/editions/[id]`, `admin/pages`, `admin/images`, `admin/users`,
   `admin/settings`, `admin/profile`, `admin/contact/messages`, `admin/layout`).
   Le reset-password (ajouté dans le chantier auth, actuellement absent de
   `dev-j`) rejoindra cette règle quand il reviendra.
2. **`not-found.tsx` racine**
   ([src/frontend/src/app/not-found.tsx](src/frontend/src/app/not-found.tsx)) :
   renvoyé quand la route ne matche rien du tout (avant même le segment
   `[locale]`). Actuellement 100 % en français avec un bouton « Retour à
   l'accueil » qui pointe `/fr`.
3. **Éventuelles futures pages d'outil** (status page, endpoints de debug,
   UI de revalidate, etc.) : par défaut hors `[locale]`.

### Redirections à définir sur `/`

Actuellement, `middleware.ts` ([middleware.ts:7](src/frontend/src/middleware.ts#L7))
fait transiter toute requête hors `api|trpc|_next|_vercel|*.*` par
`createMiddleware(next-intl)`. Avec `routing` par défaut
(`localePrefix: "always"`, [i18n/routing.ts](src/frontend/src/i18n/routing.ts)),
une requête sur `/` est redirigée sur `/fr` systématiquement.

**Décision à prendre** (voir plan §2) : garder `localePrefix: "always"` et
laisser `/` rediriger selon `Accept-Language`, ou passer en
`"as-needed"` / `"never"` et traiter `/` comme rendu direct.

## Problèmes recensés

### P1 — Critiques SEO

| # | Problème | Emplacement | Impact |
|---|---|---|---|
| 1 | **`<html lang="fr">` hardcodé** sur le layout racine. Toutes les pages `/en/...` sont servies avec l'attribut `fr`. | [src/app/layout.tsx:16](src/frontend/src/app/layout.tsx#L16) | Google et les assistive techs voient la mauvaise langue. Casse l'audit Lighthouse SEO. |
| 2 | **404 racine unilingue** qui redirige toujours vers `/fr`. | [src/app/not-found.tsx:12](src/frontend/src/app/not-found.tsx#L12) | Un visiteur anglophone arrivant sur une URL cassée reçoit un 404 en français et est forcé vers `/fr`. |
| 3 | **Pas de `x-default`** dans le sitemap ni dans `alternates.languages`. | [src/app/sitemap.ts](src/frontend/src/app/sitemap.ts), toutes les pages | Google ne sait pas quelle version servir aux locales non listées. |
| 4 | **Fichiers de traduction inversés** : `fr.json` contient la bannière en anglais, `en.json` en français. | [messages/fr.json:7](src/frontend/messages/fr.json#L7), [messages/en.json:7](src/frontend/messages/en.json#L7) | Bannière `LanguageSuggestionBanner` s'affiche dans la mauvaise langue. |
| 5 | **URLs `/fr/admin` hardcodées** dans les redirects et les emails backend. | [admin-api.ts:52,92](src/frontend/src/lib/admin-api.ts#L52), [users.ts:77](src/backend/src/routes/admin/users.ts#L77), [revalidate.ts:17](src/backend/src/lib/revalidate.ts#L17) | Émail d'invitation et redirects OAuth envoient vers `/fr/admin` même pour un utilisateur en anglais. Deviendra incohérent dès qu'on sort l'admin de `[locale]`. |

### P2 — Non indexables dans `[locale]`

| # | Problème | Emplacement |
|---|---|---|
| 6 | Admin entièrement sous `[locale]/admin/*`. `/fr/admin` et `/en/admin` sont deux URLs distinctes pour la même page, toutes les deux indexables par défaut (rien ne les bloque côté robots pour les environnements prod). | [src/app/[locale]/admin/](src/frontend/src/app/[locale]/admin/) |
| 7 | `robots.ts` ([robots.ts](src/frontend/src/app/robots.ts)) autorise tout en prod. Une fois l'admin sorti de `[locale]`, il faudra explicitement `disallow: /admin`. |

### P3 — Détection langue navigateur

| # | Problème | Emplacement |
|---|---|---|
| 8 | Détection lue uniquement côté client dans `LanguageSuggestionBanner` ([LanguageSuggestionBanner.tsx:13-26](src/frontend/src/components/LanguageSuggestionBanner.tsx#L13-L26)). Pour `/`, c'est le middleware next-intl qui redirige vers `defaultLocale=fr` sans lire `Accept-Language`. |
| 9 | Cookie `NEXT_LOCALE` observé en réponse mais pas utilisé explicitement pour personnaliser la redirection de `/`. |

### P4 — Nitpicks cache/SEO

| # | Problème | Emplacement |
|---|---|---|
| 10 | Cache header spécifique admin matche `/:locale(fr\|en)/admin/:path*` ([next.config.ts:39](src/frontend/next.config.ts#L39)) — devient caduque dès que l'admin sort de `[locale]`. |
| 11 | `metadataBase` dépend de `BASE_URL` (une seule URL), OK en prod, mais à vérifier sur environnements bêta et dev-j. |

## Plan d'action

Les actions sont ordonnées par dépendance et utilité. Chacune est
indépendante et peut être commitée à part.

### Étape 1 — Sortir l'admin de `[locale]` (prérequis structurel)

**Voir aussi** [docs/rapport-refactor-admin-a-reprendre.md](docs/rapport-refactor-admin-a-reprendre.md)
qui décrit déjà ce refactor dans son détail. Il est prérequis aux étapes 2-5
car plusieurs corrections supposent `/admin` plat.

Résultat attendu :
- `/fr/admin/...` et `/en/admin/...` → 404
- `/admin/...` → rendu directement en français
- middleware next-intl exclut `/admin`
- cache header n°10 réécrit en `/admin/:path*`

Impact SEO : `robots.ts` doit ajouter `Disallow: /admin` et `/api/admin`.

### Étape 2 — Fixer `<html lang>` dynamique

Fichier : [src/app/layout.tsx](src/frontend/src/app/layout.tsx).
Remplacer `<html lang="fr">` par une version qui lit la locale courante.

Deux approches :

**A.** Utiliser le layout `[locale]/layout.tsx` pour poser `<html lang>`
(Next.js autorise plusieurs `<html>` racines — c'est le pattern officiel
de next-intl). Supprimer le `<html>` du root layout, ne garder que le
root layout minimal (pas de body). → Implique 2 layouts `[locale]/layout`
et `admin/layout` qui rendent chacun leur `<html>`.

**B.** Dans le root layout, lire la locale via
`getLocale()` de next-intl (server component) → `<html lang={locale}>`.

Option A est plus explicite : les pages admin posent `<html lang="fr">`
(hardcodé dans le layout admin), les pages `[locale]` posent `<html lang={locale}>`.
À privilégier.

### Étape 3 — 404 racine bilingue

Deux options :

**A.** Faire de `not-found.tsx` racine un Server Component qui lit
`Accept-Language` via `headers()` et sert le texte + lien dans la bonne
langue (`/fr` si `fr`, sinon `/en`).

**B.** Laisser `not-found.tsx` en français "minimal" avec deux boutons
(Accueil FR / Home EN) et `lang="fr"` hardcodé sur une `<section>` séparée.

Option A est plus propre.

### Étape 4 — Inverser les traductions `langBanner`

Fichiers [messages/fr.json](src/frontend/messages/fr.json) et
[messages/en.json](src/frontend/messages/en.json) : échanger le contenu
de la clé `langBanner`. Vérifier aussi `dismiss` qui pourrait être inversé.

Vérifier aussi les **autres clés** pour être sûr qu'il n'y a pas d'autres
chaînes inversées. Un diff systématique `fr ↔ en` s'impose.

### Étape 5 — Ajouter `x-default` aux alternates

Deux endroits :

1. **`generateMetadata` de chaque page indexable** : ajouter
   `languages: { fr: ..., en: ..., "x-default": "..." }` (en général
   `x-default` = version `fr` puisque c'est `defaultLocale`).
   Pages concernées : home, actualites, actualites/[slug], actualites/tag/[slug],
   editions/[year], contact, billetterie, devenir-sponsor, proposer-un-talk,
   code-de-conduite, mentions-legales.

2. **`sitemap.ts`** : pour chaque entrée, ajouter une entrée
   `xDefault` dans `alternates.languages` (format Next 15+/16).
   Vérifier aussi qu'une entrée "racine" (`/`) est présente et renvoie vers
   `/fr` en `x-default`.

### Étape 6 — Retirer les URLs `/fr/` hardcodées côté backend

Après l'étape 1, les URLs `/admin` ne portent plus de locale. Il reste :

- [revalidate.ts:17](src/backend/src/lib/revalidate.ts#L17)
  `revalidatePaths(["/fr", "/en"])` → correct pour la homepage bilingue.
  À auditer pour les autres entités (si un article change, on revalide bien
  `/fr/actualites/slug` **et** `/en/actualites/slug`).

Pas de correction structurelle attendue, juste une vérification que
l'invalidation couvre bien les deux langues pour les entités bilingues.

### Étape 7 — Détection `Accept-Language` côté serveur pour `/`

Actuellement next-intl avec `localePrefix: "always"` redirige `/` vers
`/fr` sans lire `Accept-Language`. Pour que `/` envoie un visiteur
anglophone vers `/en`, il faut :

- soit activer
  [`localeDetection: true`](https://next-intl.dev/docs/routing#locale-detection)
  dans `routing.ts` (lit `Accept-Language` et pose un cookie `NEXT_LOCALE`)
- soit gérer manuellement dans le middleware (moins idiomatique).

L'activation de la détection automatique est probablement le plus simple.
Tester que `/` → `/fr` ou `/en` selon `Accept-Language`, et que
`LanguageSuggestionBanner` reste cohérent avec le choix serveur.

### Étape 8 — Bloquer `/admin` et `/api/admin` dans `robots.ts`

Ajouter `disallow: ["/admin", "/api/admin"]` dans
[src/app/robots.ts](src/frontend/src/app/robots.ts) en production, pour
éviter qu'un outil de scan tombe sur la page de login.

## Ordre recommandé

1. **Étape 1** (refactor admin hors `[locale]`) — prérequis
2. **Étape 4** (inversion `langBanner`) — trivial, indépendant
3. **Étape 2** (`<html lang>` dynamique) — grosse bascule SEO
4. **Étape 5** (`x-default` + revue canonicals) — complète le SEO multilingue
5. **Étape 7** (détection `Accept-Language`) — améliore l'UX sur `/`
6. **Étape 3** (404 racine bilingue) — nice-to-have
7. **Étape 6** (audit invalidations backend) — hygiène
8. **Étape 8** (`robots.ts` admin) — une fois l'étape 1 faite

## Ce qui n'est pas abordé dans ce rapport

- **Structured data** (Schema.org Event, Person, Article) : non inspecté ici,
  fait l'objet d'un chantier SEO à part (cf. `docs/objectifs-techniques.md`
  §SEO et §Open Graph).
- **Images OG dynamiques** : idem.
- **Breadcrumbs** : idem.
- **Performance Lighthouse** : rapport dédié à faire (objectif ≥90).

Ces sujets sont orthogonaux au problème de préfixage de langue.
