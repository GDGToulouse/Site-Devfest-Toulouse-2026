import { prisma } from "./prisma.js";

// How long the history is kept (#513). Thirteen months covers a whole edition
// cycle plus the month around the next event, when "who changed this last
// year?" gets asked.
export const AUDIT_RETENTION_MONTHS = 13;

export function auditCutoff(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - AUDIT_RETENTION_MONTHS);
  return cutoff;
}

/** Delete history lines past the retention window. Returns how many went. */
export async function purgeExpiredAuditLog(now = new Date()): Promise<number> {
  const { count } = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: auditCutoff(now) } } });
  return count;
}
