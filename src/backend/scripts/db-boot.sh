#!/bin/sh
# Bootstrap the database before starting the backend:
# 1. If the schema has never been migrated but tables already exist
#    (upgrading from the old `prisma db push` workflow), baseline the
#    initial migration as already applied — no DDL runs.
# 2. Otherwise apply pending migrations with `prisma migrate deploy`.
# 3. Then run the seed and start the server.

set -e

SCHEMA="prisma/schema.prisma"
INIT_MIGRATION="20260417000000_init"
SEED_SCRIPT="${SEED_SCRIPT:-prisma/seed.ts}"

# Small Node helper that uses the generated Prisma client to check whether
# a given table exists. Returns "yes", "no", or "check_failed" on stdout.
# We avoided `prisma db execute --stdin` which produced unstable output in
# earlier versions (no stable way to distinguish "found a row" vs. "empty
# result set" from the CLI's textual output, leading to false negatives).
has_table() {
  table_name="$1"
  node --input-type=module -e "
    import { PrismaClient } from '@prisma/client';
    const p = new PrismaClient();
    try {
      const r = await p.\$queryRawUnsafe(\"SELECT 1 AS found FROM information_schema.tables WHERE table_schema='public' AND table_name = '$table_name' LIMIT 1\");
      process.stdout.write(r.length > 0 ? 'yes' : 'no');
    } catch (e) {
      process.stderr.write('check_failed: ' + e.message + '\\n');
      process.exit(2);
    } finally {
      await p.\$disconnect();
    }
  " 2>/dev/null || echo "check_failed"
}

PRISMA_TABLE=$(has_table "_prisma_migrations")
USER_TABLE=$(has_table "user")

if [ "$PRISMA_TABLE" = "check_failed" ] || [ "$USER_TABLE" = "check_failed" ]; then
  echo "[db-boot] Could not probe the database — letting migrate deploy decide."
elif [ "$PRISMA_TABLE" = "no" ] && [ "$USER_TABLE" = "yes" ]; then
  echo "[db-boot] Existing tables detected without _prisma_migrations — baselining $INIT_MIGRATION as applied."
  pnpm exec prisma migrate resolve --schema "$SCHEMA" --applied "$INIT_MIGRATION"
elif [ "$PRISMA_TABLE" = "no" ] && [ "$USER_TABLE" = "no" ]; then
  echo "[db-boot] Fresh database — migrations will run in order."
else
  echo "[db-boot] Database already tracked by Prisma — applying pending migrations only."
fi

echo "[db-boot] Running migrate deploy..."
pnpm exec prisma migrate deploy --schema "$SCHEMA"

echo "[db-boot] Running seed ($SEED_SCRIPT)..."
pnpm exec tsx "$SEED_SCRIPT"

echo "[db-boot] Starting server..."
exec node dist/index.js
