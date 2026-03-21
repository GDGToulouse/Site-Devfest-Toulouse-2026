# CLAUDE.md

## Critical Rules

### Always
- Read code before modifying it
- Consult CLAUDE.md and specification documents before making assumptions
- Stage specific files only — never `git add .` or `git add -A`
- Use Context7 MCP to fetch up-to-date library docs before using fast-moving dependencies

### Never
- Never force-push to `main`
- Never skip git hooks (`--no-verify`)

## MCP — Context7

Use the **Context7 MCP server** to fetch up-to-date documentation for libraries before using them.
Always prefer Context7 docs over training data when working with fast-moving dependencies.

## Project Rules

Detailed rules are in `.claude/rules/`:

- **code-quality.md** — Imports, size guidelines, duplication, performance
- **coding-style.md** — Naming conventions, formatting, constants
- **communication.md** — Correction workflow, language conventions
- **error-handling.md** — Error boundaries, logging, retry strategy, user-facing errors
- **git-workflow.md** — Conventional Commits, branch naming, PRs, worktrees
- **security.md** — Secrets, input validation, OWASP, auth, headers, dependencies
- **task-management.md** — Plan mode, subagents, compaction, context management
- **testing.md** — Test strategy, naming conventions, test structure
