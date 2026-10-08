import { prisma } from "./prisma.js";
import { notDeleted } from "./admin-helpers.js";
import { revalidateAll } from "./revalidate.js";
import { EVENT_TIME_ZONE } from "./zoned-time.js";

// The home page goes to "Jour J" by itself at midnight on the day (#585), so
// nobody has to switch it in the night or in the rush of setting up.

/**
 * Only from the last stretch: an edition still in preparation or merely
 * announced is not ready for "It's today!", and a forgotten status must not
 * publish it.
 */
export const AUTO_EVENT_DAY_FROM = ["TICKETING", "PROGRAMME"] as const;

const parisDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: EVENT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today on the Toulouse calendar, `YYYY-MM-DD`, whatever the server's zone. */
export function parisDay(now: Date): string {
  return parisDayFormatter.format(now);
}

/**
 * Switches to EVENT_DAY every edition of the last stretch whose first day is
 * today in Toulouse, then purges the whole site: the header of every page
 * reads the status. Edition dates are calendar days stored at UTC midnight.
 */
export async function switchToEventDay(now: Date = new Date()): Promise<{ id: number; year: number }[]> {
  const today = parisDay(now);
  const candidates = await prisma.edition.findMany({
    where: { ...notDeleted, status: { in: [...AUTO_EVENT_DAY_FROM] }, startDate: { not: null } },
    select: { id: true, year: true, startDate: true },
  });
  const due = candidates.filter((edition) => edition.startDate!.toISOString().slice(0, 10) === today);
  for (const edition of due) {
    await prisma.edition.update({ where: { id: edition.id }, data: { status: "EVENT_DAY" } });
  }
  if (due.length > 0) await revalidateAll();
  return due.map(({ id, year }) => ({ id, year }));
}
