import type { FastifyInstance, FastifyRequest } from "fastify";

import { getAuthContext } from "../lib/auth-context.js";
import { isValidPurgeSecret, purgeExpiredTrash, retentionDays, cutoffDate } from "../lib/trash-purge.js";

/**
 * Maintenance endpoints driven by an external scheduler (#149).
 *
 * Registered outside the admin auth group on purpose: the cron has no session,
 * so this route does its own two-way check — a shared secret OR an ADMIN
 * session, never neither.
 */

const PURGE_SECRET_HEADER = "x-purge-secret";

export default async function maintenanceRoutes(app: FastifyInstance) {
  // GET /api/maintenance/purge-trash — what the next run would delete.
  // Same auth as the purge itself: it discloses how much sits in the trash.
  app.get("/maintenance/purge-trash", async (request, reply) => {
    if (!(await isAuthorised(request))) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    const days = retentionDays();
    return { retentionDays: days, cutoff: cutoffDate(new Date(), days).toISOString() };
  });

  // POST /api/maintenance/purge-trash — destroy everything past the window.
  app.post("/maintenance/purge-trash", async (request, reply) => {
    if (!(await isAuthorised(request))) {
      // 401, not 403: the caller is unidentified rather than known-and-refused.
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const report = await purgeExpiredTrash();

    // Worth a log line even when nothing happens: this is the one operation
    // that destroys data with no human watching.
    request.log.info(
      { purged: report.totalPurged, cutoff: report.cutoff, retentionDays: report.retentionDays },
      "trash purge completed",
    );

    return report;
  });
}

async function isAuthorised(request: FastifyRequest): Promise<boolean> {
  const header = request.headers[PURGE_SECRET_HEADER];
  const provided = typeof header === "string" ? header : undefined;
  if (isValidPurgeSecret(provided)) return true;

  // Falls back to an ADMIN session so the purge can also be triggered by hand
  // from the back-office (#150) without minting a secret for a browser.
  const ctx = await getAuthContext(request);
  return ctx?.user.role === "ADMIN";
}
