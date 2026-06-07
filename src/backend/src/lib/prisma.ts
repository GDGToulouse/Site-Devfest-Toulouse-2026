import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Prisma 7 drops the native query engine in favour of driver adapters: the
// client talks to Postgres through the `pg` driver. The connection string
// lives in DATABASE_URL (no longer in schema.prisma).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
