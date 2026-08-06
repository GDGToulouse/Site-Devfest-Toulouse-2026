# Error Handling

Usual principles hold: fail fast, let errors propagate through internal code, catch at system
boundaries, never swallow an exception silently, never leak stack traces or internal paths to a
client. Log with enough context to identify the operation and the resource, and never log
secrets or personal data.

## "Missing" and "broken" are not the same thing

`fetchAPI` in `src/frontend/src/lib/api.ts` draws this distinction on purpose. A 404 returns
`null`; an outage throws `BackendUnavailableError`.

Collapsing the two is what made #345 expensive: an outage returned `null`, the page called
`notFound()`, and `s-maxage=3600` then served that 404 for an hour on a resource that existed.
Keep them apart, and keep the list helpers' `|| []` fallback meaning "nothing to show" — never
"the backend is down".

## User-facing messages

Say what happened and what to do about it, in French, without technical detail. A failure must
not be silently dismissible: a save error that fades on its own reads as a success (#394).
