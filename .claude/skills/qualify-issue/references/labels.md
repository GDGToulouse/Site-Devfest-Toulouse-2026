# Labels — repo `GDGToulouse/Site-Devfest-Toulouse-2026`

Toute issue qualifiée **doit** porter au minimum 1 label de **type**. Les labels de **domaine** et le flag **`user-story`** s'ajoutent selon le contexte.

## Famille type — nature du ticket (obligatoire, exactement 1)

| Label | Sens | Couleur |
|---|---|---|
| `bug` | Quelque chose ne fonctionne pas | `#d73a4a` |
| `enhancement` | Nouvelle fonctionnalité ou amélioration | `#a2eeef` |
| `documentation` | Création / mise à jour de doc | `#0075ca` |
| `question` | Information à clarifier / décision à trancher | `#d876e3` |

> `bug` et `enhancement` sont **mutuellement exclusifs**. Choisir selon que l'issue décrit un défaut (bug) ou un ajout/amélioration (enhancement).

## Flag `user-story`

| Label | Sens | Couleur |
|---|---|---|
| `user-story` | Le ticket est une User Story (spec de feature) vs un bug ponctuel ou une tâche technique | `#c5def5` |

Se pose **en plus** du type. Les nombreuses US de backlog du repo (ex. « Programme — grille horaire publique ») portent typiquement `enhancement` + `user-story` + 1-2 domaines. Ces US relèvent de la rédaction de spec, pas de la qualification de bug.

## Famille domaine — périmètre technique

À poser quand l'issue cible un sous-système précis. Le repo est séparé frontend / backend (cf. CLAUDE.md).

| Label suggéré | Périmètre | Fichiers typiques |
|---|---|---|
| `frontend` | UI Next.js, pages publiques, composants, i18n d'affichage | `src/frontend/src/app/`, `src/frontend/src/components/` |
| `backend` | API Fastify, services, Prisma, base de données | `src/backend/src/routes/`, `src/backend/src/services/`, `src/backend/prisma/` |
| `admin` | Back-office (édition de contenu, gestion des éditions) | `src/frontend/src/components/admin/`, `src/backend/src/routes/admin/` |
| `seo` | Schema.org, Open Graph, sitemap, métadonnées | `src/frontend/src/app/**/metadata`, composants JSON-LD |
| `a11y` | Accessibilité WCAG, navigation clavier, ARIA | composants UI, axe-core |
| `i18n` | Bilingue FR/EN, next-intl, URLs localisées | `src/frontend/messages/`, `src/frontend/src/i18n/` |
| `perf` | Performance, Core Web Vitals, cache | rendu SSR, `Cache-Control`, images |

> Ces labels de domaine ne sont pas tous créés d'office dans le repo. Avant d'en poser un, vérifier son existence (`gh label list`) et le créer si besoin (voir plus bas). Ne pas coller un domaine approximatif : si aucun ne colle, en proposer un nouveau à l'utilisateur.

## Labels GitHub par défaut présents dans le repo

`bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`.

Utiliser `duplicate` / `invalid` / `wontfix` ponctuellement quand l'investigation le justifie (ex. issue qui décrit un comportement voulu → `wontfix` + explication en commentaire).

## Création / vérification des labels

Avant de poser les labels, vérifier lesquels existent :

```bash
gh label list --limit 100
```

Créer les manquants (proposer à l'utilisateur si c'est un nouveau domaine) :

```bash
gh label create "frontend" --color "1d76db" --description "Application Next.js (UI publique)"
gh label create "backend"  --color "0e8a16" --description "API Fastify / Prisma / base de données"
gh label create "admin"    --color "5319e7" --description "Back-office d'administration"
gh label create "i18n"     --color "fbca04" --description "Bilingue FR/EN, next-intl"
```

Convention couleurs :
- type : conserver les couleurs GitHub par défaut (`bug` rouge `#d73a4a`, `enhancement` cyan `#a2eeef`…) ;
- domaine : couleurs vives distinctes, éviter de doublonner une couleur de type ;
- `user-story` : bleu pâle `#c5def5`.

## Poser les labels sur une issue

```bash
gh issue edit <number> --add-label bug --add-label admin
```

Vérifier :

```bash
gh issue view <number> --json number,labels --jq '{n:.number, labels:[.labels[].name]}'
```
