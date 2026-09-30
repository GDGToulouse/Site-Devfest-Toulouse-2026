# Review: Replays link in the main menu (#489)

- **Verdict**: approve
- **Diff**: `dev-j...feature/us-489-replays-main-nav-link` (merge base `78e7edf`)
- **Axes run**: code, functional, relevancy
- **Date**: 2026_09_28
- **Findings**: 0 critical, 0 warning, 2 minor

## Phases

### Phase 1 — Hall of Replays in the nav

- [x] The new placement tests fail against the current `nav.ts` — `src/frontend/src/lib/nav.test.ts:65-96` assert a `replays` entry the base `nav.ts` never builds
- [x] Grid ready: « Programme » lists « Conférences » then « Hall of Replays »; talks only: « Conférences » lists it; no talks: first top-level entry — `src/frontend/src/lib/nav.ts:100`, `:103`, `:105`
- [x] « Hall of Replays » appears exactly once whatever the state — `src/frontend/src/lib/nav.ts:94-106` (one branch pushes it), `src/frontend/src/lib/nav.test.ts:91`
- [x] Same label on `/fr` and `/en`, no raw `nav.replays` — `src/frontend/messages/fr.json:15`, `src/frontend/messages/en.json:15`, guarded by `src/frontend/src/lib/nav.test.ts:142`
- [x] Footer Navigation column has no Hall of Replays; the archives column still shows « Replays » once — `src/frontend/src/components/Footer.tsx:91`, `:162`
- [ ] Lint, frontend tests and build pass; the link opens `/replays` from the desktop dropdown and the mobile menu, console clean — runtime criterion, out of reach of a static review; recorded by the implement step in `5dd7bcd`, tests and lint re-run after `e0abd34`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 | rot | 1 | `src/frontend/src/lib/nav.ts:24-27`, `:84-86` | The reason the replays never wait for published talks is written twice: on `REPLAYS_ENTRY` and in the rules above `getPublicNavEntries` | Optional: keep the rule on the function and cut the constant's comment to the placement it does not repeat, or leave both — they sit 60 lines apart and each reads alone |
| 🟢 | fit | 1 | `src/frontend/src/components/Footer.tsx:91` | Filtering `replays` out of the Navigation column relies on the archives column, which only renders when there is a previous edition (`:138`). With none, the footer would link the replays nowhere. Unreachable today (ten past editions); same pre-existing trade-off as the hall of fame | None required |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 83% (5/6) |
| Files checked | `src/frontend/src/lib/nav.ts`, `src/frontend/src/lib/nav.test.ts`, `src/frontend/src/components/Footer.tsx`, `src/frontend/messages/fr.json`, `src/frontend/messages/en.json`, `plan.md`, `phase-1.md` |
| Unchecked     | Lint, tests, build and browser walk — not-applicable (runtime, out of a static review) |
| Unplanned     | none |
