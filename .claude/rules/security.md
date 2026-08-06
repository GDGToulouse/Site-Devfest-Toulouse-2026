# Security

Standard practice applies (validate at boundaries, parameterize queries, escape output, never
log or commit secrets, verify permissions server-side on every request). What follows is what is
specific to *this* codebase — the parts that have already gone wrong, or would.

## Secrets

Secrets come from the environment, injected by Docker Compose. `.env` is gitignored;
`.env.example` carries placeholders. Never echo a secret into a log line, an error message, or a
test fixture.

## Opening account creation to a new kind of user

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

## better-auth drops fields it does not know about

Setting `role` in a `databaseHooks.user.create.before` hook is not enough: better-auth strips
any field absent from its own user model, so the value never reaches the database and the column
default (`EDITOR`) wins. The field must also be declared in `user.additionalFields` with
`input: false`.

This failed silently — 617 green tests, and the account still landed with back-office access.
It was only visible in the browser. A test that asserts the hook was called proves nothing here;
assert the **stored** role.

## Dependencies

`pnpm audit` (not npm — both lockfiles exist, only `pnpm-lock.yaml` is tracked). Prefer
well-maintained packages, and weigh a large transitive tree against the feature it buys.
