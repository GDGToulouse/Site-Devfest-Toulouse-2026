import { prisma } from "./prisma.js";

// How long an edition's attendees are kept (RG-ARR-66, agreed on 2026-10-29):
// 18 months after the event, to tell them about the next edition, then
// deleted. The privacy policy says so.
export const ATTENDEE_RETENTION_MONTHS = 18;

/** The last event day whose attendees are past their retention on `now`. */
export function attendeeCutoff(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - ATTENDEE_RETENTION_MONTHS);
  return cutoff;
}

/**
 * Delete the attendees of every edition whose event ended more than 18 months
 * ago, their scan history and labels with them (cascade), and mark the
 * edition so an import does not bring them back. An edition without a date is
 * left alone: its retention cannot be told. Returns the editions purged.
 */
export async function purgeExpiredAttendees(now = new Date()): Promise<Array<{ year: number; purged: number }>> {
  const cutoff = attendeeCutoff(now);
  const editions = await prisma.edition.findMany({
    where: {
      attendeesPurgedAt: null,
      // Editions that never had attendees (2016-2025) have nothing to purge.
      attendees: { some: {} },
      OR: [{ endDate: { lt: cutoff } }, { endDate: null, startDate: { lt: cutoff } }],
    },
    select: { id: true, year: true },
  });

  const report: Array<{ year: number; purged: number }> = [];
  for (const edition of editions) {
    const [{ count }] = await prisma.$transaction([
      prisma.attendee.deleteMany({ where: { editionId: edition.id } }),
      prisma.edition.update({ where: { id: edition.id }, data: { attendeesPurgedAt: now } }),
    ]);
    report.push({ year: edition.year, purged: count });
  }
  return report;
}
