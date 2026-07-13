# Git Workflow

## Commits
- Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- Subject line under 72 characters
- Stage specific files only — never `git add .` or `git add -A`
- Run each git command in a separate Bash tool call (no `&&` chaining)

## Branch strategy

### Branches permanentes

| Branche | Environnement | URL | Rôle |
|---------|---------------|-----|------|
| `main` | Production | `https://devfesttoulouse.fr` | Code en production, toujours stable et déployable. |
| `dev` | Bêta | `https://beta.site.devfesttoulouse.fr` | Intégration des développements. Les features terminées y sont mergées pour être testées ensemble avant la mise en production. |

### Branches de développeur

Chaque développeur dispose d'une branche personnelle `dev-{initiale}` où `{initiale}` est la première lettre de son prénom (en minuscule). Si deux développeurs ont la même initiale, on ajoute des lettres pour désambiguïser (ex. `dev-ju`, `dev-je`).

| Branche | Environnement | URL |
|---------|---------------|-----|
| `dev-j` | Dev perso (optionnel) | `https://dev-j.site.devfesttoulouse.fr` ou local |
| `dev-m` | Dev perso (optionnel) | `https://dev-m.site.devfesttoulouse.fr` ou local |

Les branches de développeur peuvent aussi être testées uniquement en local (Docker Compose).

### Branches feature

Pour chaque fonctionnalité ou correction, le développeur crée une branche depuis sa branche `dev-{initiale}` :

- Format : `feature/us-xxx-description` ou `feature/description`
- Nommage en anglais, en kebab-case

### Flux de merge

```
feature/us-xxx-description
        ↓ PR (revue de code)
    dev-{initiale}         ← test local ou sur dev-{initiale}.site.devfesttoulouse.fr
        ↓ PR (revue de code)
       dev                 ← test d'intégration sur beta.site.devfesttoulouse.fr
        ↓ PR (revue de code + validation fonctionnelle)
      main                 ← déploiement en production sur devfesttoulouse.fr
```

### Règles

- **`main` est protégée** : merge uniquement par PR approuvée, jamais de push direct, jamais de force-push.
- **`dev` est protégée** : merge uniquement par PR depuis une branche `dev-{initiale}`.
- **Les branches `dev-{initiale}`** : le développeur y a les pleins droits (push direct autorisé). Les PRs depuis les branches feature sont recommandées mais pas obligatoires.
- Les branches feature sont supprimées après merge.
- Stratégie de merge : **squash merge** pour les PRs vers `dev` et `main` (un commit propre par feature). Merge classique autorisé de feature vers `dev-{initiale}`.

## Issues, milestones et versions

Trois outils, trois questions distinctes — ne pas les mélanger.

| Outil | Répond à | Se ferme quand |
|-------|----------|----------------|
| **Milestone « Lot N »** | Le périmètre initial est-il couvert ? | Toutes ses issues sont faites |
| **Release `vX.Y.Z`** | Qu'est-ce qui est parti en prod, et quand ? | Le tag est poussé |
| **Label** (`bug`, `enhancement`…) | De quoi s'agit-il ? | — (filtre, pas compteur) |

### Fermeture des issues

`main` est la branche par défaut : GitHub n'honore les mots-clés de fermeture
(`Closes`, `Fixes`) que sur une PR mergée **dans `main`**. Une PR feature mergée
dans `dev-{initiale}` ne ferme donc **rien**.

- **PR feature → `dev-{initiale}`** : écrire `Refs #123` (lie sans fermer).
- **PR de promotion `dev → main`** : écrire `Closes #123` pour **chaque** issue
  embarquée. Les issues se ferment ainsi au moment exact de la mise en prod.

Les PRs vers `dev` et `main` étant **squashées**, les SHA d'origine disparaissent :
la PR de promotion est le **seul** endroit fiable pour porter les `Closes`. La skill
`deploy-to-prod` collecte les `Refs #` du diff `main..dev` pour construire ce bloc.

### Label `corrigé` — suivi entre le merge et la prod

Une issue corrigée reste **ouverte** jusqu'à la mise en prod (cf. ci-dessus). Sans marqueur,
elle apparaît comme « à faire » alors que le travail est fait. D'où le label `corrigé`.

**Au merge d'une PR feature vers `dev-{initiale}`**, pour chaque issue traitée :

1. Poser le label `corrigé` sur l'issue.
2. **Commenter l'issue** en citant le ou les commits qui la corrigent (SHA court + sujet).
   Le commentaire porte le *quand* et le *quoi* ; le label ne sert qu'à filtrer.

```bash
gh issue edit <NN> --repo GDGToulouse/Site-Devfest-Toulouse-2026 --add-label "corrigé"
gh issue comment <NN> --repo GDGToulouse/Site-Devfest-Toulouse-2026 --body-file - <<'EOF'
**Corrigé** — mergé dans `dev` (beta), en attente de mise en production.

- `<sha>` — `<sujet du commit>`

L'issue sera fermée automatiquement lors de la promotion `dev → main` (release).
EOF
```

Filtres GitHub correspondants :

| Recherche | Donne |
|---|---|
| `is:issue is:open -label:corrigé` | **Ce qu'il reste à corriger** |
| `is:issue is:open label:corrigé` | Corrigé, en attente de mise en prod |

Le label **n'est jamais retiré** : il décrit l'état de l'issue (`corrigé`), pas un
environnement. À la release, l'issue se ferme via `Closes` et le label reste vrai.

### Rattachement au milestone

- Une issue va dans un milestone **seulement si elle appartient au périmètre du Lot** —
  y compris un bug qui empêche de déclarer le Lot terminé.
- Un **bug ou une amélioration découverts après la livraison du Lot** n'ont **pas**
  de milestone : ils portent un label (`bug`, `enhancement`) et apparaissent dans les
  notes de la release qui les embarque.
- Test : « peut-on déclarer le Lot terminé en laissant cette issue ouverte ? »
  Oui → pas de milestone. Non → milestone.
- Ne **jamais** créer de milestone fourre-tout permanent (`Backlog`, `v1.x`,
  `Maintenance`) : sans fin, la barre de progression ne veut rien dire. Utiliser un label.

## Remote Operations
- Remote git commands are allowed (`git push`, `git pull`, `git fetch`, `gh pr create`, etc.)
- SSH is configured via PuTTY/Pageant — no special handling needed
- Still confirm before force-push or destructive remote operations

## Worktrees

- Use git worktrees for parallel work: spin up multiple worktrees, each running its own Claude session
- Worktrees live in `.claude/worktrees/` (managed by Claude Code's `/worktree` command)
- Useful patterns: one worktree per feature, a dedicated "analysis" worktree for read-only tasks (logs, queries)

## Pull Requests
- Title under 70 characters
- Include a Summary section with 1-3 bullet points
- Include a Test Plan section
