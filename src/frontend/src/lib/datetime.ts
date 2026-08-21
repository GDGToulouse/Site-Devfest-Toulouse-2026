// Bridging an ISO instant and an `<input type="datetime-local">` (#105).
//
// The trap this exists to close: a datetime-local field reads and writes LOCAL
// wall-clock time, while the API stores a UTC instant. Slicing the ISO string
// to `YYYY-MM-DDTHH:mm` looks right and is not — it hands the input a UTC
// wall-clock, which `new Date(...)` then reads back as local and shifts by the
// offset on save. Saving a talk twice in Paris in November walked its start
// time back an hour each time, silently.
//
// So the two directions have to be symmetric, and both go through Date.

/** UTC instant → the local wall-clock the input expects (`2026-11-19T09:00`). */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Local wall-clock from the input → UTC instant for the API. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * The zone the schedule speaks in.
 *
 * Not the reader's, and above all not the server's: the grid is rendered on a
 * container that runs on UTC, so formatting "locally" printed 08:50 for a
 * session the signage calls 09:50. A time on a schedule is a place, not a
 * moment relative to whoever is looking (#106).
 */
export const EVENT_TIME_ZONE = "Europe/Paris";

// 24-hour in both locales: it is what the programme, the badges and the room
// signage print, and an English visitor reading 3:15 PM would have to convert
// back to match them.
const eventTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: EVENT_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

/** UTC instant → `09:50` in Toulouse, whatever the machine formatting it. */
export function formatEventTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : eventTimeFormatter.format(date);
}

/**
 * UTC instant → `19 novembre 2026`, in the reader's language but the event's
 * zone (#449). The header of a printed programme has to name the day, and a
 * midnight-adjacent instant would name the wrong one under any other zone.
 */
export function formatEventDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    timeZone: EVENT_TIME_ZONE,
    dateStyle: "long",
  }).format(date);
}
