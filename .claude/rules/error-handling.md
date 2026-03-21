# Error Handling

## General Principles
- Fail fast: detect errors early and surface them immediately
- Handle errors at the appropriate level — don't catch and ignore
- Never swallow exceptions silently; at minimum, log them
- Use specific error types/classes over generic ones when the distinction matters

## Error Boundaries
- **System boundaries** (API endpoints, scrapers): catch, log, return structured error responses
- **Internal code**: let errors propagate — don't wrap every call in try/catch
- **Background jobs** (scrapers, cron): catch at the top level, log, and continue processing remaining items

## Logging
- Log at the right level: `error` for failures, `warn` for recoverable issues, `info` for key events
- Include context: what operation failed, which resource, relevant IDs
- Never log sensitive data (passwords, tokens, personal information)
- Use structured logging (JSON) for machine-parseable output

## Retry Strategy
- Only retry transient failures (network errors, 5xx, rate limits)
- Use exponential backoff with jitter
- Set a max retry count (typically 3) — don't retry forever
- Log each retry attempt with the attempt number

## User-Facing Errors
- Show helpful, non-technical messages to the user
- Never expose stack traces, internal paths, or database details to the client
- Map internal errors to appropriate HTTP status codes (see `api-conventions` skill)
