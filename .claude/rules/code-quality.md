# Code Quality

## Backwards Compatibility
- Do not add backwards-compatibility hacks: no renaming to `_unused`, no re-exporting dead types, no `// removed` comments
- If something is unused, delete it completely

## Imports
- Order: external packages → internal modules → relative imports, separated by blank lines
- No unused imports — let the linter enforce this

## Size Guidelines
- Functions: if it doesn't fit on one screen (~40 lines), consider splitting
- Files: if it exceeds ~300 lines, look for extraction opportunities

## Duplication
- Tolerate 2-3 similar occurrences before extracting
- Extract only when the duplicated logic has a single reason to change

## Documentation lookup
- **Always** use Context7 MCP to fetch up-to-date documentation before using any library, framework, or API
- This applies to all dependencies, even well-known ones (React, Next.js, Prisma, etc.) — training data may be outdated
- Prefer Context7 docs over training data for: API syntax, configuration, version migration, setup instructions

## Performance
- Be mindful of N+1 queries, unbounded loops, and memory leaks
