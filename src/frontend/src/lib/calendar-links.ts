// Links that hand one session to a calendar (#443).
//
// Two of the three are composition URLs on someone else's site: they carry the
// session's public details and nothing about the visitor. The third is our own
// `.ics`, which every other client understands.

export interface CalendarSession {
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  room: string | null;
  speakers: string[];
  year: number;
  /** Absolute URL of the session page, for the event body. */
  url: string;
  /** Venue name and address, appended to the room. */
  venue?: string | null;
}

/** `2026-11-19T10:55:00.000Z` → `20261119T105500Z`. */
function compact(iso: string): string {
  return `${new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

// A session with no end time still has to land somewhere on a calendar: the
// composition URLs of Google and Outlook both require an end. Forty minutes is
// the conference format, and it is only ever used when the schedule is
// incomplete — the `.ics` omits the end instead of guessing.
const FALLBACK_MINUTES = 40;

function endOf(session: CalendarSession): string {
  if (session.endsAt) return session.endsAt;
  return new Date(new Date(session.startsAt).getTime() + FALLBACK_MINUTES * 60_000).toISOString();
}

function locationOf(session: CalendarSession): string {
  return [session.room, session.venue].filter(Boolean).join(" — ");
}

function detailsOf(session: CalendarSession): string {
  return [session.speakers.join(", "), session.url].filter(Boolean).join("\n");
}

export function googleCalendarUrl(session: CalendarSession): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: session.title,
    dates: `${compact(session.startsAt)}/${compact(endOf(session))}`,
    details: detailsOf(session),
    location: locationOf(session),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function outlookCalendarUrl(session: CalendarSession): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: session.title,
    startdt: new Date(session.startsAt).toISOString(),
    enddt: new Date(endOf(session)).toISOString(),
    body: detailsOf(session),
    location: locationOf(session),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}

/** Our own file, for Apple Calendar, Thunderbird and everything else. */
export function icsUrl(session: CalendarSession): string {
  return `/api/editions/${session.year}/schedule.ics?talks=${encodeURIComponent(session.slug)}`;
}
