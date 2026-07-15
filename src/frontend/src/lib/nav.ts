import type { Edition } from "@/lib/types";

// A public navigation entry. `labelKey` is a key under the `nav` i18n
// namespace. An entry may carry `children` — currently only "Programme",
// which nests "Conférences" once the schedule (planning) is ready (#203).
export interface NavEntry {
  key: string;
  labelKey: string;
  href: string;
  children?: NavEntry[];
}

const CONFERENCES_ENTRY: NavEntry = {
  key: "conferences",
  labelKey: "conferences",
  href: "/conferences",
};

const SPEAKERS_ENTRY: NavEntry = { key: "speakers", labelKey: "speakers", href: "/speakers" };
const SPONSORS_ENTRY: NavEntry = { key: "sponsors", labelKey: "sponsors", href: "/sponsors" };
const BLOG_ENTRY: NavEntry = { key: "blog", labelKey: "blog", href: "/actualites" };

// Build the ordered public nav entries for the given edition. Conference-,
// speaker- and sponsor-related links only appear once their content is live.
// While there are published talks but no schedule yet, "Conférences" is a
// top-level link; once the schedule is ready it becomes a "Programme" menu
// with "Conférences" nested underneath (#203).
export function getPublicNavEntries(edition: Edition | null): NavEntry[] {
  const entries: NavEntry[] = [];

  if (edition?.isScheduleReady) {
    // The schedule (planning) page lives at /programme and is built in Lot 3.
    // Until it exists, the parent points to /conferences so the menu never
    // leads to a 404; flip this href to /programme when the page ships.
    entries.push({
      key: "program",
      labelKey: "program",
      href: "/conferences",
      children: [CONFERENCES_ENTRY],
    });
  } else if (edition?.isProgramPublished) {
    entries.push(CONFERENCES_ENTRY);
  }

  if (edition?.hasSpeakers) entries.push(SPEAKERS_ENTRY);
  if (edition?.hasSponsors) entries.push(SPONSORS_ENTRY);
  entries.push(BLOG_ENTRY);

  return entries;
}
