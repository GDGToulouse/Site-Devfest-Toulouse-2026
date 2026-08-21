// Building an iCalendar file by hand (#443).
//
// No dependency: the format is a handful of rules, and the ones that actually
// bite are the boring ones — CRLF everywhere, lines folded at 75 *octets*, and
// commas escaped inside text. A file that breaks any of them imports fine in
// one client and silently not at all in another, which is exactly the sort of
// failure a green test suite never shows.

export interface CalendarEvent {
  /** Stable across regenerations — a re-import updates, never duplicates. */
  uid: string;
  start: Date;
  /** Omitted rather than invented when a session has no end time. */
  end: Date | null;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  /**
   * Bumped whenever the event changes, so a calendar honours the update. Epoch
   * seconds of the last edit: any integer works as long as it only grows.
   */
  sequence: number;
}

const CRLF = "\r\n";

/** `2026-11-19T08:50:00Z` → `20261119T085000Z`. */
function toUtcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/**
 * Escape a text value.
 *
 * Backslash first, or it would escape the escapes added after it. Commas and
 * semicolons matter because they separate values in the format: a talk called
 * "Kubernetes, Istio et le reste" splits into two properties without this.
 */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold a content line to 75 octets, continuations starting with a space.
 *
 * Octets, not characters: « Amphithéâtre » is twelve characters and fourteen
 * bytes in UTF-8. Splitting on characters overflows the limit, and splitting
 * mid-sequence corrupts the accent.
 */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let offset = 0;
  let limit = 75;
  while (offset < bytes.length) {
    let end = Math.min(offset + limit, bytes.length);
    // Never cut inside a multi-byte sequence: continuation bytes are 10xxxxxx.
    while (end > offset && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(bytes.subarray(offset, end).toString("utf8"));
    offset = end;
    limit = 74; // the leading space of a folded line counts toward the 75
  }
  return parts.join(`${CRLF} `);
}

function property(name: string, value: string): string {
  return foldLine(`${name}:${value}`);
}

export function buildCalendar(
  events: CalendarEvent[],
  options: { calendarName: string; stamp: Date },
): string {
  const stamp = toUtcStamp(options.stamp);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GDG Toulouse//DevFest Toulouse//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    property("X-WR-CALNAME", escapeText(options.calendarName)),
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(property("UID", event.uid));
    lines.push(property("DTSTAMP", stamp));
    lines.push(property("SEQUENCE", String(event.sequence)));
    lines.push(property("DTSTART", toUtcStamp(event.start)));
    // No DTEND when the session has no end time: an invented duration would be
    // wrong on someone's calendar, which is worse than a short event.
    if (event.end) lines.push(property("DTEND", toUtcStamp(event.end)));
    lines.push(property("SUMMARY", escapeText(event.summary)));
    if (event.location) lines.push(property("LOCATION", escapeText(event.location)));
    if (event.description) lines.push(property("DESCRIPTION", escapeText(event.description)));
    // URL is not a text value — it must not be escaped, commas and all.
    if (event.url) lines.push(property("URL", event.url));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join(CRLF)}${CRLF}`;
}
