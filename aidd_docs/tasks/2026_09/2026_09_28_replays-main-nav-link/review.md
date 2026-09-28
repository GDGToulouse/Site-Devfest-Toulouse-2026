# Review: Replays link in the main menu (#489)

- **Verdict**: changes-requested
- **Diff**: `dev-j...feature/us-489-replays-main-nav-link` (merge base `78e7edf`)
- **Axes run**: code, functional, relevancy
- **Date**: 2026_09_28
- **Findings**: 0 critical, 1 warning, 2 minor

## Phases

### Phase 1 — Hall of Replays in the nav

- [x] The new placement tests fail against the current `nav.ts` — `src/frontend/src/lib/nav.test.ts:60-91` assert a `replays` entry the base `nav.ts` never builds
- [x] Grid ready: « Programme » lists « Conférences » then « Hall of Replays »; talks only: « Conférences » lists it; no talks: first top-level entry — `src/frontend/src/lib/nav.ts:98`, `:101`, `:103`
- [x] « Hall of Replays » appears exactly once whatever the state — `src/frontend/src/lib/nav.ts:92-104` (one branch pushes it), `src/frontend/src/lib/nav.test.ts:86`
- [x] Same label on `/fr` and `/en`, no raw `nav.replays` — `src/frontend/messages/fr.json:15`, `src/frontend/messages/en.json:15`, guarded by `src/frontend/src/lib/nav.test.ts:139`
- [x] Footer Navigation column has no Hall of Replays; the archives column still shows « Replays » once — `src/frontend/src/components/Footer.tsx:91`, `:162`
- [ ] Lint, frontend tests and build pass; the link opens `/replays` from the desktop dropdown and the mobile menu, console clean — runtime criterion, out of reach of a static review; recorded by the implement step in `5dd7bcd`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | rot | 1 | `src/frontend/src/lib/nav.ts:54-58` | The comment describing the nav rules is now false: it says conference-related links « only appear once their content is live » and that « Conférences » is a plain top-level link, while the replays now always appear and a flat « Conférences » carries a child. It also sits above `pageEntry` instead of `getPublicNavEntries` (misplaced since #420). Plan task 2.3 targeted it; the implement step reworded the `NavEntry` comment instead | Move the comment above `getPublicNavEntries` (`:85`) and rewrite it: the three placements of the replays, and that they are the one conference-side link that never waits for published talks |
| 🟢 | fit | 1 | `src/frontend/src/components/Footer.tsx:91` | Filtering `replays` out of the Navigation column relies on the archives column, which only renders when there is a previous edition (`:138`). With none, the footer would link the replays nowhere. Unreachable today (ten past editions); same pre-existing trade-off as the hall of fame | None required; note it in the comment at `:85-90` if the dependency should stay visible |
| 🟢 | conform | 1 | `src/frontend/src/lib/nav.test.ts:87` | `.claude/rules/testing.md` asks for no logic in tests; the `flatMap`/`filter` collects keys inline. It mirrors the existing label test (`:150-157`) | Extract an `allKeys()` helper beside `keys()` (`:27`) and assert on its result |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 83% (5/6) |
| Files checked | `src/frontend/src/lib/nav.ts`, `src/frontend/src/lib/nav.test.ts`, `src/frontend/src/components/Footer.tsx`, `src/frontend/messages/fr.json`, `src/frontend/messages/en.json`, `plan.md`, `phase-1.md` |
| Unchecked     | Lint, tests, build and browser walk — not-applicable (runtime, out of a static review) |
| Unplanned     | none |
