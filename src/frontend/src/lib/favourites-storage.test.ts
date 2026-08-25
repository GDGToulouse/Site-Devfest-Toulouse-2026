import { describe, it, expect, afterEach, vi } from "vitest";

import { MAX_FAVOURITES } from "./favourites";
import {
  favouritesStorageKey,
  isSameSelection,
  readStoredFavourites,
  writeStoredFavourites,
} from "./favourites-storage";

// The local memory of #461. It is a fallback, never a source of truth, so every
// question here is the same one: does a broken store degrade to "no memory"
// rather than to a broken page?

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("the storage key", () => {
  it("carries the edition, so 2026 does not leak into 2027", () => {
    expect(favouritesStorageKey(2026)).not.toBe(favouritesStorageKey(2027));
  });
});

describe("reading the stored selection", () => {
  it("returns what was written", () => {
    writeStoredFavourites(2026, ["keynote-ouverture", "terraform-sans-douleur"]);

    expect(readStoredFavourites(2026)).toEqual([
      "keynote-ouverture",
      "terraform-sans-douleur",
    ]);
  });

  it("reads nothing for an edition that has none", () => {
    writeStoredFavourites(2026, ["keynote-ouverture"]);

    expect(readStoredFavourites(2025)).toEqual([]);
  });

  it("treats an unreadable value as no memory at all", () => {
    localStorage.setItem(favouritesStorageKey(2026), "{not json");

    // It can only come from another version of this code or a hand-edited
    // store. Either way it must not surface as an exception.
    expect(readStoredFavourites(2026)).toEqual([]);
  });

  it("ignores a value of the wrong shape", () => {
    localStorage.setItem(favouritesStorageKey(2026), '{"slugs":["a"]}');

    expect(readStoredFavourites(2026)).toEqual([]);
  });

  it("drops entries that are not slugs", () => {
    localStorage.setItem(favouritesStorageKey(2026), '["a", 3, null, "", "b"]');

    expect(readStoredFavourites(2026)).toEqual(["a", "b"]);
  });

  it("applies the same ceiling as the URL", () => {
    const many = Array.from({ length: MAX_FAVOURITES + 20 }, (_, i) => `talk-${i}`);
    localStorage.setItem(favouritesStorageKey(2026), JSON.stringify(many));

    expect(readStoredFavourites(2026)).toHaveLength(MAX_FAVOURITES);
  });

  it("gives up quietly when storage itself throws", () => {
    // Private browsing, or storage disabled: the page must behave as it did
    // before this feature existed, not break.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

    expect(() => readStoredFavourites(2026)).not.toThrow();
    expect(readStoredFavourites(2026)).toEqual([]);
  });
});

describe("writing the stored selection", () => {
  it("clears the key when the last favourite is unstarred", () => {
    writeStoredFavourites(2026, ["keynote-ouverture"]);
    writeStoredFavourites(2026, []);

    // Emptied on purpose means nothing, not "the previous list".
    expect(localStorage.getItem(favouritesStorageKey(2026))).toBeNull();
    expect(readStoredFavourites(2026)).toEqual([]);
  });

  it("gives up quietly when the quota is full", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    expect(() => writeStoredFavourites(2026, ["a"])).not.toThrow();
  });
});

describe("comparing two selections", () => {
  it("does not care about order", () => {
    // `?fav=b,a` after starring a then b is the same selection, and offering to
    // "bring back" an identical one would be noise.
    expect(isSameSelection(["a", "b"], ["b", "a"])).toBe(true);
  });

  it("separates a different one", () => {
    expect(isSameSelection(["a", "b"], ["a"])).toBe(false);
    expect(isSameSelection(["a"], ["b"])).toBe(false);
  });
});
