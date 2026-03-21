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
