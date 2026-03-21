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

## Performance
- Be mindful of N+1 queries, unbounded loops, and memory leaks
