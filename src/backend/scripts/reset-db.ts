// Drops and recreates the public schema once per reset token (#714).
// Used by db-boot.sh on dev-j, so the environment can switch branches without
// keeping the other branch's migrations. The last token is kept as the
// schema's comment: same token, nothing happens; new token, the database is
// emptied and db-boot.sh then migrates and seeds it like a fresh one.
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";

const COMMENT_PREFIX = "db-reset:";
// COMMENT ON takes no bind parameter: the token is inlined, so it must be inert.
const TOKEN_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

const token = process.argv[2];
if (!token || !TOKEN_PATTERN.test(token)) {
  process.stderr.write("usage: reset-db.ts <token> — letters, digits, . _ - only, 64 max\n");
  process.exit(2);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  const rows = await prisma.$queryRawUnsafe<Array<{ comment: string | null }>>(
    "SELECT obj_description('public'::regnamespace, 'pg_namespace') AS comment",
  );
  const comment = rows[0]?.comment ?? null;
  if (comment === COMMENT_PREFIX + token) {
    process.stdout.write(`[db-boot] Reset token "${token}" already applied — keeping the data.\n`);
  } else {
    process.stdout.write(`[db-boot] New reset token "${token}" — dropping every table of the public schema.\n`);
    await prisma.$transaction([
      prisma.$executeRawUnsafe("DROP SCHEMA public CASCADE"),
      prisma.$executeRawUnsafe("CREATE SCHEMA public"),
      prisma.$executeRawUnsafe(`COMMENT ON SCHEMA public IS '${COMMENT_PREFIX}${token}'`),
    ]);
    process.stdout.write("[db-boot] Database emptied.\n");
  }
} catch (e) {
  process.stderr.write("reset_failed: " + (e as Error).message + "\n");
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
