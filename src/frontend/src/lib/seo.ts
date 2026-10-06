import { extractYouTubeId } from "./youtube";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

/**
 * Serialise a JSON-LD object for injection into a <script> tag.
 *
 * `JSON.stringify` leaves `<` untouched, so a value containing `</script>`
 * closes the tag early and everything after it is parsed as HTML — stored XSS.
 * That is reachable: a speaker editing their own profile through a magic link
 * can set `company`, which feeds `worksFor` here, and it is length-capped but
 * never sanitised.
 *
 * Escaping `<`, `>` and `&` as unicode sequences keeps the JSON semantically
 * identical (the parser resolves them back) while making the string incapable
 * of terminating the element.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

// Schema.org expects absolute URLs. Uploaded assets are stored as /uploads/…,
// so they need the site origin prepended before they go into JSON-LD (#185).
// Speaker photos imported from 2016-2019 are hosted on third-party domains and
// are already absolute — those pass through untouched (#356, #465).
export function absoluteUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${BASE_URL}${path}`;
}

/**
 * Whether an Event carries the two fields Google requires of one (#464).
 *
 * Both are optional in the database — an edition in preparation legitimately
 * has neither a date nor a venue yet — while both builders emit them as
 * `?? undefined`. That combination produces an Event missing a required field,
 * which is precisely the pair Search Console reports: "champ startDate
 * manquant", "champ location manquant".
 *
 * The answer is to emit nothing at all. No rich result costs nothing; an
 * invalid one is a critical error on the report. A placeholder would be worse
 * still — Google penalises structured data that does not match what the page
 * shows.
 *
 * One function rather than the same condition written in two pages: it is one
 * rule, and it has one reason to change (what Google requires).
 */
export function isCompleteEvent(event: { startDate?: string; location?: unknown }): boolean {
  return Boolean(event.startDate && event.location);
}

/**
 * The locale a single-language entity canonicalises to (#468).
 *
 * `Talk.language` is a plain `String` in the schema. A value the site cannot
 * serve is read as "no opinion" and leaves the page bilingual, rather than
 * canonicalising it to a URL that does not exist. Every talk carries "fr" or
 * "en" today — the historical import normalises to those two — so this guards
 * a future data drift, not a current case.
 *
 * Here rather than beside `pageMetadata`, which the sitemap must not import:
 * that module reaches for `next-intl/server`, and the sitemap has no request
 * locale to give it.
 */
export function canonicalLocaleFor(language: string | null | undefined): string | undefined {
  return language === "fr" || language === "en" ? language : undefined;
}

const ORGANIZER = {
  "@type": "Organization" as const,
  name: "GDG Toulouse",
  url: "https://gdg.community.dev/gdg-toulouse/",
};

/**
 * One session as a schema.org Event (#382), the way the home page announces
 * the whole edition. `path` is the page's own path: the Event points back at
 * it, and borrows its generated social card as image.
 *
 * Null until the session has an hour and the edition a venue: Google requires
 * both, and an Event short of one is a critical error rather than a missing
 * rich result (#464). Same choices as the edition's Event, for the same
 * reasons: no `superEvent`, no `previousStartDate` (#185, #239).
 */
export function buildTalkEventJsonLd(
  talk: {
    title: string;
    description: string;
    startsAt: string | null;
    endsAt: string | null;
    room: string | null;
    speakers: { name: string }[];
  },
  edition: { venueName: string | null; venueAddress: string | null } | null,
  path: string,
) {
  if (!talk.startsAt || !edition?.venueName) return null;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: talk.title,
    description: talk.description || talk.title,
    url: absoluteUrl(path),
    image: absoluteUrl(`${path}/opengraph-image`),
    startDate: talk.startsAt,
    endDate: talk.endsAt ?? undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: talk.room ? `${talk.room}, ${edition.venueName}` : edition.venueName,
      address: {
        "@type": "PostalAddress",
        addressLocality: edition.venueAddress ?? undefined,
        addressRegion: "Occitanie",
        addressCountry: "FR",
      },
    },
    organizer: ORGANIZER,
    ...(talk.speakers.length > 0 && {
      performer: talk.speakers.map((s) => ({ "@type": "Person" as const, name: s.name })),
    }),
  };
}

/**
 * A replay as a schema.org VideoObject (#382), which opens video rich results:
 * searching a DevFest's replays surfaced YouTube and third-party lists, never
 * the conference's own archive.
 *
 * Google requires `uploadDate`, which we do not store. The edition's date
 * stands in: a recording cannot be published before the talk was given, so it
 * is a true lower bound. Without it, or without a YouTube id to build the
 * thumbnail from, nothing is emitted — a VideoObject short of a required field
 * is an error, not a missing result.
 */
export function buildVideoJsonLd(
  talk: { title: string; description: string; videoUrl: string },
  uploadDate: string | null,
) {
  const id = extractYouTubeId(talk.videoUrl);
  if (!id || !uploadDate) return null;
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: talk.title,
    description: talk.description || talk.title,
    thumbnailUrl: [`https://i.ytimg.com/vi/${id}/hqdefault.jpg`],
    uploadDate,
    embedUrl: `https://www.youtube.com/embed/${id}`,
  };
}
