#!/bin/sh
# Bootstrap the database before starting the backend:
# 1. If the schema has never been migrated but the tables already exist
#    (upgrading from the old `prisma db push` workflow), baseline the
#    initial migration as already applied — no DDL runs.
# 2. Otherwise apply pending migrations with `prisma migrate deploy`.
# 3. Then run the seed and start the server.
#
# This replaces the previous `prisma db push --accept-data-loss` which
# silently dropped columns/tables when the schema drifted.

set -e

SCHEMA="prisma/schema.prisma"
INIT_MIGRATION="20260417000000_init"
SEED_SCRIPT="${SEED_SCRIPT:-prisma/seed.ts}"

# Detect whether Prisma's migration bookkeeping table exists yet.
# If `_prisma_migrations` is missing but the `user` table is present, we
# are upgrading an environment that used `prisma db push` — baseline the
# init migration as applied without re-running the SQL.
HAS_PRISMA_TABLE=$(pnpm exec prisma db execute --schema "$SCHEMA" --stdin <<SQL 2>/dev/null || echo "error"
SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations';
SQL
)

HAS_USER_TABLE=$(pnpm exec prisma db execute --schema "$SCHEMA" --stdin <<SQL 2>/dev/null || echo "error"
SELECT 1 FROM information_schema.tables WHERE table_name = 'user';
SQL
)

if ! echo "$HAS_PRISMA_TABLE" | grep -q "1"; then
  if echo "$HAS_USER_TABLE" | grep -q "1"; then
    echo "[db-boot] Existing tables detected without _prisma_migrations — baselining $INIT_MIGRATION as applied."
    pnpm exec prisma migrate resolve --schema "$SCHEMA" --applied "$INIT_MIGRATION"
  else
    echo "[db-boot] Fresh database — migrations will run in order."
  fi
fi

echo "[db-boot] Running migrate deploy..."
pnpm exec prisma migrate deploy --schema "$SCHEMA"

echo "[db-boot] Running seed ($SEED_SCRIPT)..."
pnpm exec tsx "$SEED_SCRIPT"

echo "[db-boot] Starting server..."
exec node dist/index.js
