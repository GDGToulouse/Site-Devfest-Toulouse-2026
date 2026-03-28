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

## Development workflow — Test Driven Development

Every feature or fix follows this strict cycle. Do not skip steps.

### Step 1 — Write code + unit/integration tests
1. Write the implementation code.
2. Write the associated automated tests (unit and/or integration).
3. **Commit** the code and tests together (`feat:` or `fix:`).

### Step 2 — Run automated tests
4. Run the full test suite (`npm test` or equivalent).
5. If tests fail: fix the code or tests, then **commit** the fix (`fix: correct ...`).
6. Repeat until all tests pass.

### Step 3 — Functional testing via browser
7. Start the dev server if not running.
8. Use the **Chrome DevTools MCP** to navigate to the relevant page(s).
9. Verify the feature visually and interactively:
   - Does the page render correctly?
   - Do interactions work (clicks, forms, navigation)?
   - Are there console errors?
   - Is the layout correct on the target viewport?
10. If issues are found: fix, **commit**, and re-test (go back to step 7).

### Step 4 — Push
11. All automated tests pass, functional verification is clean.
12. **Push** to the remote branch.

### Summary

```
Write code + tests
      ↓
   Commit
      ↓
Run automated tests ──fail──→ Fix → Commit → (re-run)
      ↓ pass
Functional test (Chrome DevTools MCP) ──fail──→ Fix → Commit → (re-test)
      ↓ pass
    Push
```

### Rules
- Never push code that has failing tests.
- Never push code that has not been functionally verified in the browser.
- Each fix is its own commit — do not amend the original commit.
- If a fix changes the implementation significantly, update the tests accordingly.
