import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../generated/prisma/client.js";
import { guardUnscopedWrites } from "./guard-unscoped-writes.js";

// `lib/prisma.ts` reuses `globalThis.prisma` when it exists (outside production):
// seeding it here with the guarded client puts the guard under the audit
// extension for every test file, without touching production code. A file that
// mocks `lib/prisma` never reads it, and the client connects lazily.
const globalForPrisma = globalThis as unknown as { prisma?: unknown };

if (!globalForPrisma.prisma) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  globalForPrisma.prisma = new PrismaClient({ adapter }).$extends(guardUnscopedWrites);
}
