// The visitor's own selection of sessions (#442).
//
// It lives in the URL and nowhere else: no account, no server-side storage, no
// browser storage. The visitor bookmarks the page, reopens it on another
// device, or sends it to a colleague — and gets the same selection back.
//
// The sessions are named by `slug` because that is the only identifier the
// public payload carries; there is no numeric id to shorten it with.

/**
 * How many sessions a link may carry.
 *
 * A DevFest day holds fewer than fifty sessions in total, so this is a guard
 * against a hand-edited or mangled URL, not a limit anyone reaches: past it the
 * querystring gets long enough for mail clients to wrap and break the link.
 */
export const MAX_FAVOURITES = 60;

/** The three ways to read the grid. */
export type ScheduleView = "all" | "mine" | "mine-only";

const VIEWS: ScheduleView[] = ["all", "mine", "mine-only"];

/** `?fav=a,b,c` → `["a", "b", "c"]`, cleaned of blanks and duplicates. */
export function parseFavourites(param: string | undefined | null): string[] {
  if (!param) return [];
  const seen = new Set<string>();
  for (const raw of param.split(",")) {
    const slug = raw.trim();
    // An unknown slug is not filtered here — a session cancelled after someone
    // bookmarked the page simply matches nothing, and the page still renders.
    if (slug) seen.add(slug);
    if (seen.size >= MAX_FAVOURITES) break;
  }
  return [...seen];
}

/** `["a", "b"]` → `"a,b"`, empty when there is nothing to say. */
export function serializeFavourites(slugs: string[]): string {
  return slugs.slice(0, MAX_FAVOURITES).join(",");
}

export function toggleFavourite(slugs: string[], slug: string): string[] {
  return slugs.includes(slug)
    ? slugs.filter((s) => s !== slug)
    : [...slugs, slug].slice(0, MAX_FAVOURITES);
}

/** Anything unexpected in `?view=` falls back to the whole programme. */
export function parseView(param: string | undefined | null): ScheduleView {
  return VIEWS.includes(param as ScheduleView) ? (param as ScheduleView) : "all";
}
