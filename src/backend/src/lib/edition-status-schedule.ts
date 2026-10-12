import { prisma } from "./prisma.js";
import { notDeleted } from "./admin-helpers.js";
import { revalidateAll } from "./revalidate.js";
import { EVENT_TIME_ZONE } from "./zoned-time.js";

// The home page moves through the last stretch by itself, at midnight on each
// trigger day (#585): "Dernier mois" a month before the first day, "Dernière
// semaine" a week before, "Jour J" on the day. Nobody has to switch it in the
// night, and the team can still move it back by hand: the switch happens on
// the trigger day only, never as a rule enforced every day.

type Status = "PREPARATION" | "ANNOUNCEMENT" | "TICKETING" | "PROGRAMME" | "EVENT_DAY" | "SEE_YOU_NEXT_YEAR";

/** The order an edition goes through: a switch only ever moves forward. */
const ORDER: Status[] = ["PREPARATION", "ANNOUNCEMENT", "TICKETING", "PROGRAMME", "EVENT_DAY", "SEE_YOU_NEXT_YEAR"];

/**
 * Where a switch may start from. Never PREPARATION — an edition not yet
 * announced is not ready for a ticket office, let alone "It's today!" — and
 * never SEE_YOU_NEXT_YEAR, which is behind.
 */
const SWITCHABLE: Status[] = ["ANNOUNCEMENT", "TICKETING", "PROGRAMME"];

export const AUTO_SWITCHES: { status: Status; daysBefore?: number; monthsBefore?: number }[] = [
  { status: "TICKETING", monthsBefore: 1 },
  { status: "PROGRAMME", daysBefore: 7 },
  { status: "EVENT_DAY", daysBefore: 0 },
];

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
 * The calendar day of each switch for an edition starting on `startDate`
 * (stored at UTC midnight), `YYYY-MM-DD`. A month before the 31st falls on the
 * last day of the shorter month, as the admin hint shows it.
 */
export function switchDays(startDate: Date): { status: Status; day: string }[] {
  return AUTO_SWITCHES.map(({ status, daysBefore = 0, monthsBefore = 0 }) => {
    const y = startDate.getUTCFullYear();
    const m = startDate.getUTCMonth() - monthsBefore;
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const day = new Date(Date.UTC(y, m, Math.min(startDate.getUTCDate(), lastDay) - daysBefore));
    return { status, day: day.toISOString().slice(0, 10) };
  });
}

/**
 * Applies today's switch, if any, to every edition: forward only, from a
 * switchable status, then purges the whole site — the header of every page
 * reads the status.
 */
export async function applyScheduledStatus(now: Date = new Date()): Promise<{ id: number; year: number; status: Status }[]> {
  const today = parisDay(now);
  const editions = await prisma.edition.findMany({
    where: { ...notDeleted, status: { in: SWITCHABLE }, startDate: { not: null } },
    select: { id: true, year: true, status: true, startDate: true },
  });
  const switched: { id: number; year: number; status: Status }[] = [];
  for (const edition of editions) {
    const due = switchDays(edition.startDate!).find((s) => s.day === today);
    if (!due || ORDER.indexOf(due.status) <= ORDER.indexOf(edition.status)) continue;
    await prisma.edition.update({ where: { id: edition.id }, data: { status: due.status } });
    switched.push({ id: edition.id, year: edition.year, status: due.status });
  }
  if (switched.length > 0) await revalidateAll();
  return switched;
}
