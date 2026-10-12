import type { ScheduleRow } from "./schedule";
import { EVENT_TIME_ZONE } from "./datetime";

// The "next slot" button of the programme on the day (#575): which row it
// leads to, and whether the day is on at all.

/**
 * The row that starts next, among the rows shown — filters and "my sessions"
 * included — or null outside the day: before its first slot, after its last
 * one ends, or once nothing is left to start.
 */
export function nextSlot(rows: ScheduleRow[], now: Date): { key: string; startsAt: string } | null {
  if (rows.length === 0) return null;
  const at = now.getTime();
  const start = Math.min(...rows.map((row) => Date.parse(row.startsAt)));
  const end = Math.max(
    ...rows.map((row) =>
      row.type === "band"
        ? Date.parse(row.entry.endsAt)
        : Math.max(Date.parse(row.startsAt), ...row.cells.flat().map((cell) => Date.parse(cell.talk.endsAt ?? row.startsAt))),
    ),
  );
  if (at < start || at >= end) return null;
  const next = rows.find((row) => Date.parse(row.startsAt) > at);
  return next ? { key: next.key, startsAt: next.startsAt } : null;
}

/**
 * `?now=2026-11-19T10:20` read as Toulouse time: a rehearsal of the button on
 * any day, beta and production included. It moves nothing but this button.
 */
export function parseSimulatedNow(value: string | null): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // The zone's offset at that moment: format the UTC instant in Paris and
  // measure how far the wall clock is from it.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: EVENT_TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(asUtc))
      .map((part) => [part.type, Number(part.value)]),
  );
  const offset = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - asUtc;
  return new Date(asUtc - offset);
}
