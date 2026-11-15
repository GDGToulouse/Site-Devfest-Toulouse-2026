// When registrations close (#822). Billetweb's API documentation describes no
// event field for it — the deadline set in its back-office ("date limite des
// inscriptions") is not on the tariffs either, a re-import on the beta showed
// no `end_time` on 16 November. So the import looks for any event field whose
// name speaks of a sales end and whose value reads as a date, and reports the
// date-like fields it saw, so the admin knows when to type the date by hand.
import { parseWallTime } from "./zoned-time.js";

// `start` and `end` are the event's own dates, never the sales deadline.
const EVENT_DATE_FIELDS = new Set(["start", "end", "last_update", "creation", "created"]);
const SALES_END_NAME = /(sale|sell|vente|clos|deadline|limit|registration|inscri|stop)/i;

// A Unix timestamp in seconds (Billetweb's tariffs) or a wall-clock date-time in
// Paris time ("2026-11-16 23:55:00", Billetweb's events). Null otherwise.
export function readBilletwebDate(value: unknown): Date | null {
  // Ten digits: a plausible timestamp (2001-2286). A shorter number is a rate,
  // a quota or an id — `tax_rate: 20` once read as 1 January 1970.
  if (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) {
    const n = Number(value);
    return n >= 1_000_000_000 && n < 10_000_000_000 ? new Date(n * 1000) : null;
  }
  // Only a string that starts like a date: parseWallTime hands anything with a
  // trailing "-2026" to `new Date`, which read the event's slug and shop URL
  // as 1 January 2026 on the beta.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value.trim())) return null;
  return parseWallTime(value.trim().replace(" ", "T"));
}

export interface SalesEndLookup {
  /** The deadline found on the event, or null. */
  salesEndAt: Date | null;
  /** The event field it was read from. */
  field: string | null;
  /** Every date-like field of the event, by name: what the admin is shown. */
  dateFields: Record<string, string>;
}

export function findSalesEnd(event: Record<string, unknown> | undefined): SalesEndLookup {
  const dateFields: Record<string, string> = {};
  let found: { field: string; date: Date } | null = null;
  for (const [key, value] of Object.entries(event ?? {})) {
    const date = readBilletwebDate(value);
    if (!date) continue;
    dateFields[key] = date.toISOString();
    if (!found && !EVENT_DATE_FIELDS.has(key) && SALES_END_NAME.test(key)) {
      found = { field: key, date };
    }
  }
  return { salesEndAt: found?.date ?? null, field: found?.field ?? null, dateFields };
}
