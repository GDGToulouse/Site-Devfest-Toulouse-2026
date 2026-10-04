// Sessionize writes session times as wall-clock times with no offset
// ("2026-11-19T09:50:00"), meaning the time on the venue's clocks. The backend
// container runs in UTC, so `new Date()` on that string would shift the whole
// grid by one or two hours (#519).

export const EVENT_TIME_ZONE = "Europe/Paris";

const WALL_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;
const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/;

/** Milliseconds `timeZone` is ahead of UTC at `instant`. */
function offsetAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const field = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wallAsUtc = Date.UTC(field("year"), field("month") - 1, field("day"), field("hour"), field("minute"), field("second"));
  return wallAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant a wall-clock time in `timeZone` stands for, or null when the
 * string is not a date-time. A string that already carries an offset is taken
 * as is.
 */
export function parseWallTime(value: string | null | undefined, timeZone = EVENT_TIME_ZONE): Date | null {
  if (!value) return null;
  if (HAS_OFFSET.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const match = WALL_TIME.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const wallAsUtc = Date.UTC(+year, +month - 1, +day, +hour, +minute, +(second ?? 0));
  // The offset depends on the instant, which is what we are looking for: guess
  // with the offset at the wall time read as UTC, then correct once in case the
  // guess crossed a daylight-saving change.
  const guess = wallAsUtc - offsetAt(new Date(wallAsUtc), timeZone);
  const corrected = wallAsUtc - offsetAt(new Date(guess), timeZone);
  return new Date(corrected);
}
