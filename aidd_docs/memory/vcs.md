# VCS

## Setup

- Main branch: `main` (production). Branche d'intégration : `dev` (beta)
- Platform: `github` — `GDGToulouse/Site-Devfest-Toulouse-2026`

## Branches

- Format: `<type>/us-<issue>-<description-en-kebab-case>`, en anglais, partie de la branche perso `dev-{initiale}`
- Types in use: `feature`, `fix`, `docs`, `chore` ; `promote/vX.Y.Z-to-main` pour la promotion
- Chaîne : `feature/*` → `dev-{initiale}` (merge classique) → `dev` (squash) → `main` (squash)
- Hotfix beta : branche partie de `dev`, PR directe vers `dev`, sans attendre ce qui est en cours sur `dev-{initiale}`
- Après une release, la PR de redescente de version arrive sur `dev` ; la remonter ensuite à la main sur chaque `dev-{initiale}` (merge classique)
- `main` et `dev` sont protégées : PR uniquement, jamais de force-push

## Commits

- Convention: Conventional Commits
- Format: `type(scope): description`, sujet sous 72 caractères, corps qui dit **pourquoi**
- Rules: étager fichier par fichier (jamais `git add .`/`-A`), une commande git par appel, jamais `--no-verify`

Détail, PR et faux conflits après squash : `.claude/rules/git-workflow.md`. Fermeture des issues : `docs/cycle-de-vie-issues.md`.

## Commit Strategy

AI should auto commit: `after phase`

Commiter est libre ; pousser, ouvrir ou merger une PR se valide avec l'humain d'abord (`.claude/rules/git-workflow.md` § Opérations distantes).
