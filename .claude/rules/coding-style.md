# Coding Style

- Do not add docstrings, type annotations, or comments to code you did not change
- Avoid over-engineering: no premature abstractions, no feature flags for one-time operations
- Three similar lines of code is better than a premature abstraction
- Boolean variables: use `is`, `has`, `can`, `should` prefixes
- Functions: use verbs (`get`, `create`, `update`, `delete`, `validate`, `handle`)
- Only validate at system boundaries (user input, external APIs); trust internal code

## Formatting
- Delegate to tooling (Prettier, ESLint) — don't manually fix formatting
- Do not bikeshed on style that the formatter handles

## Constants
- Use `UPPER_SNAKE_CASE` for true constants (compile-time values, config keys)
- Use regular `camelCase` for values that are just assigned once at runtime
