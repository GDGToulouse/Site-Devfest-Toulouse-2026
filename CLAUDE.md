# CLAUDE.md

## Project Overview

DevFest Toulouse 2026 website — a new site built to replace the WordPress (Avada) site used for 2023-2025 editions. The goal is a durable, maintainable site that can be managed across editions.

## Architecture

The project is split into two independent applications:

- **`frontend/`** — Next.js (App Router, Server Components) — SSR pages, UI, static assets
- **`backend/`** — API REST — business logic, database access, email, third-party integrations

The frontend calls the backend via HTTP (`http://backend:4000` in Docker, configurable via `BACKEND_URL`). The backend exposes a public REST API that can be consumed by the frontend, mobile apps, or any other client. Prisma and the database are owned by the backend; the frontend never accesses the database directly.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), Tailwind CSS v4, next-intl, pnpm |
| Backend | Node.js (framework TBD: Fastify or Hono), Prisma, PostgreSQL |
| Auth | Auth.js v5 (Google + GitHub OAuth) — admin only |
| Email | SMTP (Postfix or equivalent, MailHog in dev) |
| Hosting | VPS + Coolify, Docker Compose |
| CI/CD | GitHub Actions (lint, typecheck, tests) |

## Project Structure

```
frontend/                      # Next.js application
├── src/
│   ├── app/[locale]/          # Pages with i18n routing (/fr/..., /en/...)
│   ├── components/            # Shared React components
│   ├── lib/                   # Utilities (auth, api client)
│   └── i18n/                  # next-intl configuration
├── messages/                  # Translation files (fr.json, en.json)
├── public/                    # Static assets (favicon, fonts, images)
├── next.config.ts
├── tailwind.config.ts         # (or @theme in globals.css for Tailwind v4)
├── package.json
└── Dockerfile

backend/                       # REST API
├── src/
│   ├── routes/                # API route handlers
│   ├── services/              # Business logic
│   ├── lib/                   # Utilities (prisma, email, auth)
│   └── index.ts               # Server entry point
├── package.json
└── Dockerfile

prisma/                        # Database schema (used by backend)
├── schema.prisma
└── migrations/

docs/                          # Specification documents (in French)
├── fonctionnalites-2026.md    # Feature list for the 2026 site
├── objectifs-techniques.md    # Technical objectives (SEO, perf, a11y, rendering)
├── historique-sites.md        # Analysis of past DevFest Toulouse sites (2016-2025)
├── modele-donnees-historique.md  # Data model for devfest-history.json
├── modele-donnees-metier.md   # Business data model (entities, relationships)
├── maquettes-figma.md         # Figma mockups inventory and structure
├── design-system.md           # Design system, tokens, UI kit, brand guidelines
├── variables-environnement.md # Environment variables reference (Docker Compose)
├── maquettes/                 # SVG exports of all Figma mockups
└── assets/                    # Logo files, sketch illustrations (3 colors)

data/
└── devfest-history.json       # Historical data: speakers & sessions (2016-2025)

docker-compose.yml             # Dev environment: frontend + backend + db + mailhog
.env.example                   # Environment variables template
.claude/rules/                 # Detailed coding & workflow rules
```

## Specification Documents

Always consult these documents before making assumptions about features or architecture:

- **`docs/fonctionnalites-2026.md`** — Complete feature list (pages, components, user roles)
- **`docs/objectifs-techniques.md`** — Technical objectives: SSR + cache strategy, Lighthouse targets (≥90), Core Web Vitals, SEO, accessibility (WCAG 2.1 AA), i18n readiness, security headers
- **`docs/historique-sites.md`** — Evolution of past sites (stacks, features per year)
- **`docs/modele-donnees-historique.md`** — Schema for `data/devfest-history.json` (327 speakers, 282 sessions across 7 editions)
- **`docs/modele-donnees-metier.md`** — Business data model: all domain entities, attributes, relationships and bilingual strategy
- **`docs/maquettes-figma.md`** — Figma mockups: pages designed, shared components, structure ([Figma file](https://www.figma.com/design/5dw9ggMfrdFrB9qEKYvHH6/DevFestToulouse-2025?node-id=22-499))
- **`docs/design-system.md`** — Design system: brand guidelines, color palette (Google Sans), design tokens, UI kit (Font Awesome icons), content style guide
- **`docs/variables-environnement.md`** — All environment variables: database, SMTP, OAuth, API keys, secrets — injected via Docker Compose

## Key Technical Decisions (from specs)

- **Architecture**: frontend (Next.js) + backend (REST API) separated, communicating via HTTP
- **Rendering**: SSR + HTTP cache for all public pages; hybrid SSR+SPA for authenticated pages
- **Cache**: `Cache-Control: s-maxage=3600, stale-while-revalidate=60`; on-demand invalidation via admin
- **Homepage**: conditional content based on annual status (preparation / announcement / see-you-next-year)
- **User roles**: admin, sponsor, speaker — sponsors and speakers can edit their own profiles via magic links
- **SEO**: Schema.org (Event, Organization, Person, Article), Open Graph, Twitter Cards, dynamic OG images
- **Performance**: Lighthouse ≥90 all categories, LCP <2.5s, INP <200ms, CLS <0.1
- **Accessibility**: WCAG 2.1 AA, keyboard nav, skip-to-content, axe-core in CI
- **i18n**: natively bilingual (FR default + EN), localized URLs (`/fr/...`, `/en/...`)
- **Database**: PostgreSQL, accessed only by the backend via Prisma ORM
- **API**: REST, publicly accessible, backend owns all business logic and data

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
