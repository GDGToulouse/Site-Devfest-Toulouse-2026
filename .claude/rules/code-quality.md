# Code Quality

## Backwards Compatibility
- Do not add backwards-compatibility hacks: no renaming to `_unused`, no re-exporting dead types, no `// removed` comments
- If something is unused, delete it completely

## Performance
- Be mindful of N+1 queries, unbounded loops, and memory leaks
