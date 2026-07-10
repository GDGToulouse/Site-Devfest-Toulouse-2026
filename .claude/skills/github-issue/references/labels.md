# Labels — repo `GDGToulouse/Site-Devfest-Toulouse-2026`

Chaque issue **doit** avoir au minimum 1 label de **type**. Le repo n'utilise pas de labels de domaine custom : la **structuration fonctionnelle passe par les milestones « Lot N »** (voir [milestones.md](milestones.md)), pas par des labels.

## Famille type — nature du ticket

| Label | Sens | Couleur |
|---|---|---|
| `bug` | Quelque chose ne fonctionne pas | `#d73a4a` |
| `enhancement` | Nouvelle fonctionnalité ou amélioration | `#a2eeef` |
| `documentation` | Création / mise à jour de doc | `#0075ca` |
| `question` | Information à clarifier / décision à trancher | `#d876e3` |

> `bug` et `enhancement` sont **mutuellement exclusifs**. `documentation` / `question` peuvent se combiner avec un autre type si besoin.

## User Story

Le repo **n'a pas de label `user-story`**. Une US se reconnaît à son **format de body** (« En tant que… je veux… afin que… ») ; le label reste `enhancement`. Ne pas créer de label `user-story` sauf demande explicite de l'utilisateur.

## Labels GitHub par défaut

Présents dans le repo, utilisables ponctuellement : `duplicate`, `invalid`, `wontfix`, `good first issue`, `help wanted`. Ne pas en abuser.

## Création de labels

Le repo se contente volontairement des labels par défaut. **Ne pas créer de nouveaux labels** (domaine, priorité…) sans accord explicite de l'utilisateur — la granularité fonctionnelle est portée par les milestones.

Si l'utilisateur valide la création d'un label :

```bash
gh label list --limit 100
gh label create "<nom>" --color "<hex sans #>" --description "<desc>"
```

Convention couleurs : conserver les couleurs GitHub par défaut pour les types ; couleurs vives distinctes pour d'éventuels labels custom validés.
