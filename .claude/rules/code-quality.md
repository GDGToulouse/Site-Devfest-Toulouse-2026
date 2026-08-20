# Code Quality

Write code that reads like the code around it: match its naming, its comment density, its idiom.
The existing files are the specification — a new component in `src/frontend/src/components/admin/`
should be indistinguishable in style from its neighbours.

## Delete, don't deprecate

No backwards-compatibility scaffolding: no renaming to `_unused`, no re-exporting dead types, no
`// removed` comments, no shim kept "just in case". If something is unused, delete it. This is a
young codebase with one consumer — a stale shim costs more than a rewrite.

## Comments carry the why

The code says what it does. A comment earns its place by saying what the code cannot: why this
approach over the obvious one, which bug it prevents, which constraint forced it. Reference the
issue when there is one — `(#375)` tells the next reader where to look.

Do not add docstrings, type annotations or comments to code you did not otherwise change.

## Abstraction

Tolerate two or three similar occurrences before extracting. Extract when the duplicated logic
has a single reason to change, not when it merely looks alike. Three similar lines beat a
premature abstraction.

Watch for N+1 queries, unbounded reads on tables that keep growing, and unbounded loops. When a
query needs a ceiling, make it a guard well above the real volume and say so in a comment.
