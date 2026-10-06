# CLAUDE.md

DevFest Toulouse 2026 — site remplaçant le WordPress (Avada) des éditions 2023-2025.
Objectif : un site durable, maintenable d'une édition à l'autre.

## Où vit quoi

Chaque fait a **une seule maison**. Avant d'en écrire un, chercher s'il existe déjà.

| Nature | Maison | Chargée |
|---|---|---|
| Ce qu'est le projet : architecture, pièges, conventions, environnements | `aidd_docs/memory/` | à chaque session (bloc ci-dessous) |
| Comment travailler : git, tests, sécurité, erreurs | `.claude/rules/` | au lancement, ou à la lecture d'un fichier `src/` pour les règles de code |
| Specs et procédures pour humains | `docs/` | à la demande |
| Ce qui ne vaut que pour une personne ou une machine | mémoire auto de Claude | index à chaque session |

## Règles impératives

- Étager les fichiers un par un — jamais `git add .` ni `git add -A`
- Une commande git par appel Bash — jamais de `&&`, jamais `cd`, jamais `git -C`
- Jamais de force-push sur `main`, jamais de `--no-verify`
- Jamais de connexion SSH au VPS, même en lecture seule : préparer la commande et la donner à Julien, qui l'exécute
- Utiliser Context7 MCP pour la doc des bibliothèques avant de les employer

## Règles détaillées

| Fichier | Sujet | Chargée |
|---|---|---|
| `.claude/rules/git-workflow.md` | Commits, branches, PR, worktrees | toujours |
| `.claude/rules/communication.md` | Langue, workflow de correction | toujours |
| `.claude/rules/task-management.md` | Mode plan, sous-agents, compaction | toujours |
| `.claude/rules/testing.md` | Écrire ou lancer des tests, vérifier avant de pousser | fichiers `src/` |
| `.claude/rules/code-quality.md` | Imports, taille, duplication, performance | fichiers `src/` |
| `.claude/rules/coding-style.md` | Nommage, constantes, formatage | fichiers `src/` |
| `.claude/rules/error-handling.md` | Gestion et remontée des erreurs | fichiers `src/` |
| `.claude/rules/security.md` | Auth, secrets, validation d'entrées, headers, ouverture des comptes | backend, admin, config |
| `docs/cycle-de-vie-issues.md` | Fermer, étiqueter (`corrigé`) ou rattacher une issue | à lire au moment d'agir |

## Documentation

Consulter avant de faire des hypothèses sur le métier ou l'architecture. `docs/` (en français) :

| Fichier | Contenu |
|---|---|
| `fonctionnalites-2026.md` | Périmètre fonctionnel (pages, composants, rôles) |
| `objectifs-techniques.md` | SSR + cache, Lighthouse ≥90, Core Web Vitals, SEO, WCAG 2.1 AA, i18n |
| `modele-donnees-metier.md` | Entités, relations, stratégie bilingue |
| `modele-donnees-historique.md` | Schéma de `devfest-history.json` (327 speakers, 279 sessions) |
| `historique-sites.md` | Évolution des sites passés (2016-2025) |
| `design-system.md` | Charte, palette, tokens, kit UI |
| `maquettes-figma.md` | Inventaire des maquettes ([Figma](https://www.figma.com/design/5dw9ggMfrdFrB9qEKYvHH6/DevFestToulouse-2025?node-id=22-499)) |
| `api-publique.md` | API REST publique (OpenAPI/Swagger) |
| `audit-droits-api.md` | Qui peut appeler chaque route, constats de l'audit avant le connecteur MCP (#514) |
| `variables-environnement.md` | Variables d'environnement |
| `comptes-dev-local.md` | Comptes de test, MailHog |
| `priorisation-developpement.md` | Lots de développement, rétroplanning 2026 |
| `mise-en-production.md` | Procédure de déploiement en production |
| `deployer-nouvel-environnement.md` | Ajouter un environnement (`dev-x`, beta, prod) |
| `coolify-pieges-multi-environnements.md` | Pièges Coolify récurrents |
| `traduction-ia.md` | Traduction assistée pour les éditeurs |
| `cycle-de-vie-issues.md` | Issues, milestones, label `corrigé`, `Refs` / `Closes` |

## Memory Management

Project docs, memory, specs, and plans live in `aidd_docs/`.

### Project memory

<!-- aidd_project_memory:start -->

@aidd_docs/memory/api.md
@aidd_docs/memory/architecture.md
@aidd_docs/memory/auth.md
@aidd_docs/memory/backlog.md
@aidd_docs/memory/codebase-map.md
@aidd_docs/memory/coding-assertions.md
@aidd_docs/memory/database.md
@aidd_docs/memory/deployment.md
@aidd_docs/memory/design.md
@aidd_docs/memory/ecosystem.md
@aidd_docs/memory/forms.md
@aidd_docs/memory/integration.md
@aidd_docs/memory/navigation.md
@aidd_docs/memory/project-brief.md
@aidd_docs/memory/testing.md
@aidd_docs/memory/vcs.md

<!-- aidd_project_memory:end -->

- If the block above is empty, run `ls -1tr aidd_docs/memory/` and read each file.
- Load `aidd_docs/memory/external/*` when the user asks.
- Load `aidd_docs/memory/internal/*` when the task needs it.
