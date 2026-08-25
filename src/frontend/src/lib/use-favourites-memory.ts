"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  isSameSelection,
  readStoredFavourites,
  writeStoredFavourites,
} from "./favourites-storage";

/**
 * Reconciles the URL's selection with the one remembered locally (#461).
 *
 * | On arrival                     | What is shown                          |
 * |--------------------------------|----------------------------------------|
 * | `?fav=` in the URL             | the URL's, which becomes the stored one |
 * | no `?fav=`, storage not empty  | the stored one, written back to the URL |
 * | neither                        | nothing                                 |
 *
 * The link wins, but nothing is lost: when it supersedes a stored selection
 * that is genuinely different, `superseded` holds the old one so the page can
 * offer to take it back.
 *
 * The read happens after mount, never during render: this page is server
 * rendered with `s-maxage`, and the server has no `localStorage` to agree with.
 */
export function useFavouritesMemory(
  year: number,
  urlFavourites: string[],
  onRestore: (slugs: string[]) => void,
): { superseded: string[] | null; dismiss: () => void } {
  const [superseded, setSuperseded] = useState<string[] | null>(null);
  // Both are captured once, at first render, and never refreshed: the effect
  // below runs on mount only, and going through refs keeps it from re-running
  // on a new array identity or a new closure. Every later change to the
  // selection goes through the caller, not through here.
  const arrivedWith = useRef(urlFavourites);
  const restore = useRef(onRestore);

  useEffect(() => {
    const stored = readStoredFavourites(year);
    const fromUrl = arrivedWith.current;

    if (fromUrl.length === 0) {
      // The nominal case this issue exists for: back on the page without the
      // querystring that carried the selection.
      if (stored.length > 0) restore.current(stored);
      return;
    }

    if (stored.length > 0 && !isSameSelection(stored, fromUrl)) {
      setSuperseded(stored);
    }
    writeStoredFavourites(year, fromUrl);
  }, [year]);

  // Stable, because the notice registers it as a document listener.
  const dismiss = useCallback(() => setSuperseded(null), []);

  return { superseded, dismiss };
}
