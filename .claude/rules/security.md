# Security

## Secrets Management
- Never hardcode secrets (API keys, passwords, tokens) in source code
- Use environment variables via `.env` files (excluded from git via `.gitignore`)
- Never log secrets — mask or omit them from error messages and stack traces
- Never commit `.env` files; provide a `.env.example` with placeholder values

## Input Validation
- Validate and sanitize all user input at system boundaries (API endpoints, form handlers)
- Validate type, length, format, and allowed ranges
- Reject unexpected fields — use allowlists, not blocklists
- Parameterize all database queries — never interpolate user input into SQL

## Common Vulnerabilities (OWASP)
- **Injection**: use parameterized queries and prepared statements
- **XSS**: escape output rendered in HTML; use framework auto-escaping
- **CSRF**: use anti-CSRF tokens on state-changing requests
- **Sensitive data exposure**: never return passwords, tokens, or internal IDs in API responses unless required

## Dependencies
- Prefer well-maintained packages with active security advisories
- Review dependency additions — avoid pulling in large transitive trees for small features

## Security Headers
- Set `Content-Security-Policy` to restrict script/style sources
- Enable `Strict-Transport-Security` (HSTS) with a long max-age
- Set `X-Frame-Options: DENY` (or use CSP `frame-ancestors`)
- Set `X-Content-Type-Options: nosniff`

## Authentication & Authorization
- Verify permissions on every request — never rely solely on client-side checks
- Use constant-time comparison for tokens and secrets

### Opening account creation to a new kind of user

`User.role` is `UserRole @default(EDITOR)`, and `requireAnyAuthenticated` lets
`EDITOR` through. Any account created without an explicit role therefore gets
the back-office. That default was safe while only administrators could hold an
account; it stops being safe the moment a third party can create one.

So, before opening sign-up to a new kind of user (sponsor #362, speaker #363):

- Add a **neutral** `UserRole` value for them and set it explicitly on create.
  Never let them fall back to the default.
- Do **not** widen `requireAnyAuthenticated` — it guards the back-office, whose
  fine-grained authorization happens inside the handlers. Give the newcomer its
  own guard reading its own link table (e.g. `SponsorContact.accessRole` via
  `requireSponsorAccess`).
- Reject the account at `user.create.before` rather than after the fact, so a
  failed attempt leaves no orphan row behind.

## Dependency Updates
- Run `npm audit` / `yarn audit` regularly
- Update dependencies with known vulnerabilities promptly
- Pin major versions to avoid unexpected breaking changes
