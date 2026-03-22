# CLAUDE.md

## Project Overview

DevFest Toulouse 2026 website — a new site built to replace the WordPress (Avada) site used for 2023-2025 editions. The goal is a durable, maintainable site that can be managed across editions.

The project is currently in the **specification phase** — no application code exists yet. The `src/` directory has not been created.

## Project Structure

```
docs/                          # Specification documents (in French)
├── fonctionnalites-2026.md    # Feature list for the 2026 site
├── objectifs-techniques.md    # Technical objectives (SEO, perf, a11y, rendering)
├── historique-sites.md        # Analysis of past DevFest Toulouse sites (2016-2025)
└── modele-donnees-historique.md  # Data model for devfest-history.json
data/
└── devfest-history.json       # Historical data: speakers & sessions (2016-2025)
.claude/rules/                 # Detailed coding & workflow rules
```

## Specification Documents

Always consult these documents before making assumptions about features or architecture:

- **`docs/fonctionnalites-2026.md`** — Complete feature list (pages, components, user roles)
- **`docs/objectifs-techniques.md`** — Technical objectives: SSR + cache strategy, Lighthouse targets (≥90), Core Web Vitals, SEO, accessibility (WCAG 2.1 AA), i18n readiness, security headers
- **`docs/historique-sites.md`** — Evolution of past sites (stacks, features per year)
- **`docs/modele-donnees-historique.md`** — Schema for `data/devfest-history.json` (327 speakers, 282 sessions across 7 editions)

## Key Technical Decisions (from specs)

- **Rendering**: SSR + HTTP cache for all public pages; hybrid SSR+SPA for authenticated pages
- **Cache**: `Cache-Control: s-maxage=3600, stale-while-revalidate=60`; on-demand invalidation via admin
- **Homepage**: conditional content based on annual status (preparation / announcement / see-you-next-year)
- **User roles**: admin, sponsor, speaker — sponsors and speakers can edit their own profiles
- **SEO**: Schema.org (Event, Organization, Person, Article), Open Graph, Twitter Cards, dynamic OG images
- **Performance**: Lighthouse ≥90 all categories, LCP <2.5s, INP <200ms, CLS <0.1
- **Accessibility**: WCAG 2.1 AA, keyboard nav, skip-to-content, axe-core in CI
- **i18n**: natively bilingual (FR default + EN), localized URLs (`/fr/...`, `/en/...`)

## Critical Rules

### Always
- Read code before modifying it
- Consult specification documents in `docs/` before making assumptions
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
