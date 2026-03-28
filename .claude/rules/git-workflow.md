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
