import type { ContentPageSummary, Edition } from "@/lib/types";

// A public navigation entry. `labelKey` is a key under the `nav` i18n
// namespace. An entry may carry one level of `children` — the header renders
// no deeper — such as "Programme", which nests "Conférences" once the schedule
// (planning) is ready (#203).
export interface NavEntry {
  key: string;
  labelKey: string;
  href: string;
  children?: NavEntry[];
  // Admin-authored pages carry their own title in both languages and have no
  // i18n key, so they bring a ready-made label instead (#420). Callers must
  // prefer it over translating `labelKey`.
  label?: string;
}

const CONFERENCES_ENTRY: NavEntry = {
  key: "conferences",
  labelKey: "conferences",
  href: "/conferences",
};

// The replays span every edition (#489), so unlike the programme they never
// wait for the current edition to publish talks: they hang under it when it
// exists and stand on their own when it does not — the months between two
// editions, when the archives are what the site has to show.
const REPLAYS_ENTRY: NavEntry = { key: "replays", labelKey: "replays", href: "/replays" };

const SPEAKERS_ENTRY: NavEntry = { key: "speakers", labelKey: "speakers", href: "/speakers" };
const SPONSORS_ENTRY: NavEntry = { key: "sponsors", labelKey: "sponsors", href: "/sponsors" };
// Partner job offers hang under Sponsors (#251). The parent link already leads
// to /sponsors, so the submenu lists only the offers — no duplicate entry — and
// appears only once an offer is actually published.
const JOB_OFFERS_CHILD: NavEntry = {
  key: "job-offers",
  labelKey: "jobOffers",
  href: "/offres-emploi-partenaires",
};
// The hall of fame hangs under Speakers (#369), the way the job offers hang
// under Sponsors. It spans every edition rather than the current one, so it
// rides on the parent's condition: no speakers announced, no menu, and the
// footer link — which is always there — remains the way in.
const HALL_OF_FAME_CHILD: NavEntry = {
  key: "hall-of-fame",
  labelKey: "hallOfFame",
  href: "/hall-of-fame",
};
const BLOG_ENTRY: NavEntry = { key: "blog", labelKey: "blog", href: "/actualites" };
// Venue & practical-info page (#109). Shown only once the edition has map
// coordinates or a written transports/parking section (hasVenueInfo).
const VENUE_ENTRY: NavEntry = { key: "venue", labelKey: "venue", href: "/lieu" };

// An admin-authored page as a navigation entry (#420). Only published pages
// reach here — the API filters drafts out — so no status check is needed.
function pageEntry(page: ContentPageSummary, locale: string): NavEntry {
  const title = locale === "en" && page.titleEn.trim() ? page.titleEn : page.titleFr;
  return { key: `page-${page.slug}`, labelKey: "", href: `/${page.slug}`, label: title };
}

function pagesAt(
  pages: ContentPageSummary[],
  location: "HEADER" | "FOOTER",
  locale: string,
): NavEntry[] {
  return pages
    .filter((p) => p.navLocation === location)
    .sort((a, b) => a.navOrder - b.navOrder || a.slug.localeCompare(b.slug))
    .map((p) => pageEntry(p, locale));
}

// Pages placed in the footer bar, beside the permanent legal links (#420).
export function getFooterPageEntries(
  pages: ContentPageSummary[] = [],
  locale = "fr",
): NavEntry[] {
  return pagesAt(pages, "FOOTER", locale);
}

// Build the ordered public nav entries for the given edition. Talk-, speaker-
// and sponsor-related links only appear once their content is live. While
// there are published talks but no schedule yet, "Conférences" is a top-level
// menu; once the schedule is ready it becomes a "Programme" menu with
// "Conférences" nested underneath (#203). The replays are the exception: they
// span past editions, so they sit under whichever of the two exists and stand
// top-level when the edition has no talks yet (#489).
export function getPublicNavEntries(
  edition: Edition | null,
  pages: ContentPageSummary[] = [],
  locale = "fr",
): NavEntry[] {
  const entries: NavEntry[] = [];

  if (edition?.isScheduleReady) {
    // The grid itself (#106), with the searchable list nested under it.
    entries.push({
      key: "program",
      labelKey: "program",
      href: "/programme",
      children: [CONFERENCES_ENTRY, REPLAYS_ENTRY],
    });
  } else if (edition?.isProgramPublished) {
    entries.push({ ...CONFERENCES_ENTRY, children: [REPLAYS_ENTRY] });
  } else {
    entries.push(REPLAYS_ENTRY);
  }

  if (edition?.hasSpeakers) entries.push({ ...SPEAKERS_ENTRY, children: [HALL_OF_FAME_CHILD] });
  if (edition?.hasSponsors) {
    entries.push(
      edition.hasJobOffers ? { ...SPONSORS_ENTRY, children: [JOB_OFFERS_CHILD] } : SPONSORS_ENTRY,
    );
  }
  if (edition?.hasVenueInfo) entries.push(VENUE_ENTRY);
  entries.push(BLOG_ENTRY);

  // Free pages come after the system entries, never between them: the order of
  // those is driven by the edition's status and is not the editor's to change.
  entries.push(...pagesAt(pages, "HEADER", locale));

  return entries;
}
