# Git Workflow

Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`), sujet sous
72 caractères. Le corps du message dit **pourquoi**, pas quoi — le diff dit déjà quoi.

Étager les fichiers un par un, jamais `git add .`. Une commande git par appel Bash : ni `&&`,
ni `cd`, ni `git -C`.

## Branches

| Branche | Environnement | Déploiement |
|---|---|---|
| `main` | Production — `devfesttoulouse.fr` | **Manuel** : un push ne déploie pas, le Redeploy Coolify est lancé à la main |
| `dev` | Bêta — `beta.site.devfesttoulouse.fr` | **Automatique** sur push (~5 min ; vérifier `/api/health`) |
| `dev-{initiale}` | Dev perso — `dev-j.site.devfesttoulouse.fr` ou local | Selon le développeur |

Une branche personnelle par développeur (`dev-j`, `dev-m`… ; on désambiguïse en `dev-ju`/`dev-je`
si besoin). Les branches feature partent de la branche perso : `feature/us-xxx-description`, en
anglais, en kebab-case, supprimées après merge.

```
feature/us-xxx  →  dev-{initiale}  →  dev  →  main
                        (local)      (beta)   (prod)
```

- `main` et `dev` sont **protégées** : merge par PR uniquement, jamais de push direct ni de
  force-push. Sur sa branche perso, le développeur a les pleins droits.
- **Squash** vers `dev` et `main` (un commit par feature) ; merge classique de feature vers la
  branche perso.
- Une PR `dev-j → dev` peut lever de **faux conflits add/add** après squash : c'est une branche
  de promotion, et `-X ours` y duplique des blocs. Vérifier l'arbre plutôt que de faire
  confiance à la résolution automatique.

## Pull requests

Titre sous 70 caractères. Un résumé en 1 à 3 points, et un plan de test qui dit ce qui a été
vérifié **et ce qui ne l'a pas été**. Les points non évidents — une hypothèse fausse au départ,
un défaut dans l'énoncé de l'issue, une réserve — valent plus que l'énumération des fichiers
touchés.

`Refs #123` sur une PR feature (elle ne ferme rien), `Closes #123` seulement sur la PR de
promotion vers `main`. Le détail est dans `.claude/rules/issue-lifecycle.md`.

## Opérations distantes

`push`, `pull`, `fetch`, `gh pr create` sont autorisés sans confirmation (SSH via
PuTTY/Pageant). Demander avant tout force-push ou opération destructive.

## Worktrees

Pour du travail parallèle : un worktree par feature, chacun avec sa session. Ils vivent dans
`.claude/worktrees/`.
