#!/bin/sh
# Bootstrap the database before starting the backend:
# 1. If the schema has never been migrated but tables already exist
#    (upgrading from the old `prisma db push` workflow), baseline the
#    initial migration as already applied — no DDL runs.
# 2. Otherwise apply pending migrations with `prisma migrate deploy`.
# 3. Then run the seed and start the server.

set -e

INIT_MIGRATION="20260417000000_init"
SEED_SCRIPT="${SEED_SCRIPT:-prisma/seed.ts}"

# Uses the generated Prisma client (via scripts/has-table.ts) to check whether
# a given table exists. Returns "yes", "no", or "check_failed" on stdout.
# We avoided `prisma db execute --stdin` which produced unstable output in
# earlier versions (no stable way to distinguish "found a row" vs. "empty
# result set" from the CLI's textual output, leading to false negatives).
# Prisma 7: the client is generated under src/generated/prisma and talks to
# Postgres through the pg driver adapter (no native engine, no schema URL).
# The probe lives in a real .ts file (not tsx --eval) so top-level await works.
has_table() {
  pnpm exec tsx scripts/has-table.ts "$1" 2>/dev/null || echo "check_failed"
}

PRISMA_TABLE=$(has_table "_prisma_migrations")
USER_TABLE=$(has_table "user")

if [ "$PRISMA_TABLE" = "check_failed" ] || [ "$USER_TABLE" = "check_failed" ]; then
  echo "[db-boot] Could not probe the database — letting migrate deploy decide."
elif [ "$PRISMA_TABLE" = "no" ] && [ "$USER_TABLE" = "yes" ]; then
  echo "[db-boot] Existing tables detected without _prisma_migrations — baselining $INIT_MIGRATION as applied."
  pnpm exec prisma migrate resolve --applied "$INIT_MIGRATION"
elif [ "$PRISMA_TABLE" = "no" ] && [ "$USER_TABLE" = "no" ]; then
  echo "[db-boot] Fresh database — migrations will run in order."
else
  echo "[db-boot] Database already tracked by Prisma — applying pending migrations only."
fi

echo "[db-boot] Running migrate deploy..."
pnpm exec prisma migrate deploy

echo "[db-boot] Running seed ($SEED_SCRIPT)..."
pnpm exec tsx "$SEED_SCRIPT"

echo "[db-boot] Starting server..."
exec node dist/index.js
