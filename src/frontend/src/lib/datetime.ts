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

/** UTC instant → `09:00`, for reading a schedule at a glance. */
export function isoToLocalTime(iso: string): string {
  return isoToLocalInput(iso).slice(11);
}
