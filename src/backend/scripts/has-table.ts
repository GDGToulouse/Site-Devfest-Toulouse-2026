// Prints "yes" or "no" depending on whether the given public table exists.
// Used by db-boot.sh to decide whether to baseline the initial migration.
// Run via tsx so it loads the TypeScript-generated Prisma 7 client directly.
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";

const tableName = process.argv[2];
if (!tableName) {
  process.stderr.write("usage: has-table.ts <table_name>\n");
  process.exit(2);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  const rows = await prisma.$queryRawUnsafe<Array<{ found: number }>>(
    "SELECT 1 AS found FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1",
    tableName,
  );
  process.stdout.write(rows.length > 0 ? "yes" : "no");
} catch (e) {
  process.stderr.write("check_failed: " + (e as Error).message + "\n");
  process.exit(2);
} finally {
  await prisma.$disconnect();
}
