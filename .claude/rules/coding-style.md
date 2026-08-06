# Coding Style

Formatting is Prettier's and ESLint's job — do not fix by hand what tooling handles, and do not
bikeshed it.

Booleans read as assertions: `is`, `has`, `can`, `should`. Functions are verbs. `UPPER_SNAKE_CASE`
is for true compile-time constants, `camelCase` for anything merely assigned once at runtime.

Validate at system boundaries — user input, external APIs — and trust internal code.

Avoid premature abstraction and one-off feature flags. The bar for a new indirection is a second
real caller, not an imagined one.
