import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";
import { withAudit } from "./audit.js";
import { oauthNullableLists } from "./oauth-nullable-lists.js";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Prisma 7 drops the native query engine in favour of driver adapters: the
// client talks to Postgres through the `pg` driver. The connection string
// lives in DATABASE_URL (no longer in schema.prisma).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const base = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = base;

// Every import of `prisma` gets the audited client (#513), so no write path can
// opt out by accident. The OAuth list fix (#514) rides along for better-auth.
export const prisma = withAudit(base).$extends(oauthNullableLists);
