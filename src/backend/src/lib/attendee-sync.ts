import { prisma } from "./prisma.js";
import { importAttendees } from "./attendee-import.js";
import { stationWindow } from "./arrivals-station.js";
import { runInContext, systemContext } from "./request-context.js";

// The attendees follow Billetweb by themselves on event day (#800): a ticket
// added by hand in the morning is known to the entrance within five minutes,
// a refund too. Only while the stations are open (RG-ARR-71): the rest of the
// year an import is the admin's call, and Billetweb is not polled for nothing.

/** The editions to sync now: linked, not purged, their stations' window open. */
export async function editionsToSync(now = new Date()): Promise<number[]> {
  const editions = await prisma.edition.findMany({
    where: { deletedAt: null, billetwebEventId: { not: null }, attendeesPurgedAt: null },
    select: { id: true, startDate: true, endDate: true, stationAccessFrom: true, stationAccessUntil: true },
  });
  return editions
    .filter((edition) => {
      const { from, until } = stationWindow(edition);
      return from !== null && until !== null && from <= now && now <= until;
    })
    .map((edition) => edition.id);
}

/**
 * One round of the five-minute sync. Never throws: a failed import is written
 * on its edition (`attendeesSyncError`) for the admin, and the next round retries.
 */
export async function runAttendeeSync(log: {
  warn: (obj: object, msg: string) => void;
  error: (obj: object, msg: string) => void;
}): Promise<void> {
  try {
    for (const editionId of await editionsToSync()) {
      await runInContext(systemContext("Synchronisation Billetweb"), async () => {
        const result = await importAttendees(editionId, log);
        if (!result.ok && result.reason !== "import_running") log.warn({ editionId, reason: result.reason }, "Attendee sync skipped");
      });
    }
  } catch (err) {
    log.error({ err }, "Attendee sync failed");
  }
}
