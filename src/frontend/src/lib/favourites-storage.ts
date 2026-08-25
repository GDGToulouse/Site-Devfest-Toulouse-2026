// A local memory of the selection (#461).
//
// #442 put the selection in the URL and nowhere else, and that stays true of
// what is *shareable*. This is only a fallback for the same browser on the same
// device: star four sessions, click "Speakers" in the menu, come back to
// /programme — the querystring is gone, and the selection with it.
//
// Nothing here ever reaches the server. The HTML stays identical for every
// visitor, so the page stays cacheable and there is no `Vary` to add.

import { MAX_FAVOURITES } from "./favourites";

/** One key per edition: a 2026 selection means nothing on the 2027 grid. */
export function favouritesStorageKey(year: number): string {
  return `devfest:favourites:${year}`;
}

/**
 * Every access is guarded. Private browsing, a full quota, storage disabled by
 * the browser — each of them throws, and this feature has to degrade to the URL
 * alone rather than take the page down with it.
 *
 * A value that is not the shape we wrote is treated as absent rather than
 * allowed to surface as an exception: it can only come from another version of
 * this code or from a hand-edited store.
 */
export function readStoredFavourites(year: number): string[] {
  try {
    const raw = window.localStorage.getItem(favouritesStorageKey(year));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((slug): slug is string => typeof slug === "string" && slug !== "")
      .slice(0, MAX_FAVOURITES);
  } catch {
    return [];
  }
}

export function writeStoredFavourites(year: number, slugs: string[]): void {
  try {
    // An emptied selection clears the key rather than storing `[]`: unstarring
    // the last session has to mean "nothing", not "the previous list".
    if (slugs.length === 0) {
      window.localStorage.removeItem(favouritesStorageKey(year));
      return;
    }
    window.localStorage.setItem(
      favouritesStorageKey(year),
      JSON.stringify(slugs.slice(0, MAX_FAVOURITES)),
    );
  } catch {
    // Nothing to do, and nothing to say: the URL still carries the selection.
  }
}

/** Order is not part of a selection — `a,b` and `b,a` are the same one. */
export function isSameSelection(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const inA = new Set(a);
  return b.every((slug) => inA.has(slug));
}
