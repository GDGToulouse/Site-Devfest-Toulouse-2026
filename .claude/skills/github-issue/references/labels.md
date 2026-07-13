# Labels — repo `GDGToulouse/Site-Devfest-Toulouse-2026`

Chaque issue **doit** avoir au minimum 1 label de **type**. Trois familles : **type** (obligatoire), **domaine** (optionnel), **état** (posé au fil de l'eau, jamais à la création).

## Famille type — nature du ticket

| Label | Sens | Couleur |
|---|---|---|
| `bug` | Quelque chose ne fonctionne pas | `#d73a4a` |
| `enhancement` | Nouvelle fonctionnalité ou amélioration | `#a2eeef` |
| `documentation` | Création / mise à jour de doc | `#0075ca` |
| `question` | Information à clarifier / décision à trancher | `#d876e3` |

> `bug` et `enhancement` sont **mutuellement exclusifs**. `documentation` / `question` peuvent se combiner avec un autre type si besoin.

## Famille domaine — où ça se passe

| Label | Périmètre |
|---|---|
| `frontend` | Application Next.js (UI publique) |
| `backend` | API Fastify / Prisma / base de données |
| `admin` | Back-office d'administration |
| `seo` | SEO, métadonnées, Open Graph, sitemap |
| `infra` | Docker Compose, Coolify, réseau, déploiement, SMTP |

Cumulables (ex. `bug` + `backend` + `admin`).

## Famille état

| Label | Sens | Couleur |
|---|---|---|
| `corrigé` | Correction mergée, en attente de mise en production | `#1a7f37` |

**Ne jamais poser `corrigé` à la création d'une issue.** Il est posé au **merge vers
`dev-{initiale}`**, avec un commentaire citant les commits — voir
[`.claude/rules/git-workflow.md`](../../../rules/git-workflow.md) § « Label `corrigé` ».

Filtre associé : `is:issue is:open -label:corrigé` = ce qu'il reste à corriger.

## User Story

Le repo **n'a pas de label `user-story`**. Une US se reconnaît à son **format de body** (« En tant que… je veux… afin que… ») ; le label reste `enhancement`. Ne pas créer de label `user-story` sauf demande explicite de l'utilisateur.

## Labels GitHub par défaut

Présents dans le repo, utilisables ponctuellement : `duplicate`, `invalid`, `wontfix`, `good first issue`, `help wanted`. Ne pas en abuser.

## Création de labels

Les trois familles ci-dessus couvrent les besoins. **Ne pas créer de nouveau label** (priorité, statut supplémentaire…) sans accord explicite de l'utilisateur.

Si l'utilisateur valide la création d'un label :

```bash
gh label list --limit 100
gh label create "<nom>" --color "<hex sans #>" --description "<desc>"
```

Convention couleurs : conserver les couleurs GitHub par défaut pour les types ; couleurs vives distinctes pour d'éventuels labels custom validés.
