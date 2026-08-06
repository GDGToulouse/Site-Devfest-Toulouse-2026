# Testing

## Strategy
- Write tests for bug fixes (non-regression) and new features
- Don't test trivial code (getters, simple wrappers, framework glue)
- Prefer integration tests over unit tests when testing data flow

## Naming
- Test files: `*.test.ts` or `*.spec.ts`, colocated with source
- Test names: describe behavior, not implementation — `should return 404 when event not found`

## Structure
- Arrange / Act / Assert pattern
- One assertion per concept (multiple asserts are fine if they test the same behavior)
- No logic in tests (no if/else, no loops) — tests should be linear

## Development workflow

Code and tests ship together, and nothing is pushed that has not been seen working. The order
below is what that implies; it is not a ritual to perform for its own sake.

### 1 — Write the code and its tests, commit them together

A test that passes without the fix proves nothing. When fixing a bug, make the test fail first
(revert the fix, watch it go red) — that is the only way to know it is testing the right thing.

### 2 — Run the suites

```bash
# frontend
cd src/frontend && pnpm exec vitest run

# backend — DATABASE_URL must point at localhost, or ~44 tests fail with 500s
cd src/backend && DATABASE_URL="postgresql://devfest:devfest@localhost:5432/devfest?schema=public" pnpm exec vitest run
```

Integration tests share one database and run in parallel: an isolated failure that does not
reproduce is usually a fixture collision, not a regression. Re-run before chasing it, and say so
rather than passing it off as green.

### 3 — Verify in the browser

```bash
docker compose -f docker-compose.local.yml up -d
```

Drive the real page through the **Chrome DevTools MCP**: does it render, do the interactions
work, is the console clean, does the layout hold at the target viewport? Tests pass on code that
is wired to nothing — several bugs on this project (a silent security fallback, a 404 in the
sitemap) were invisible to the suites and obvious in the browser.

If the environment misbehaves rather than the code, say which and why. Every route 404ing means
a stale `.next` volume, not a broken feature.

### 4 — Push

Only once the suites pass and the feature has been seen working. State what was verified and
what was not — an unobserved behaviour is not a verified one.

### Non-negotiable

- Never push failing tests, and never push what has not been seen working in the browser.
- Each fix is its own commit — do not amend the original.
