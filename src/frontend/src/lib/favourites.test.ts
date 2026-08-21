import { describe, it, expect } from "vitest";

import {
  MAX_FAVOURITES,
  parseFavourites,
  parseView,
  serializeFavourites,
  toggleFavourite,
} from "./favourites";

describe("favourites in the URL (#442)", () => {
  it("reads a comma-separated list", () => {
    expect(parseFavourites("terraform-sans-douleur,postgres-plan-execution")).toEqual([
      "terraform-sans-douleur",
      "postgres-plan-execution",
    ]);
  });

  it("treats an absent or empty parameter as no selection", () => {
    expect(parseFavourites(undefined)).toEqual([]);
    expect(parseFavourites("")).toEqual([]);
    expect(parseFavourites(",, ,")).toEqual([]);
  });

  it("keeps a bookmarked link working when a session no longer exists", () => {
    // The whole point of putting the selection in a URL is that it outlives the
    // page it was copied from. A cancelled session must not empty the link.
    const slugs = parseFavourites("session-annulee,terraform-sans-douleur");
    expect(slugs).toContain("terraform-sans-douleur");
    expect(slugs).toHaveLength(2);
  });

  it("drops duplicates rather than starring the same session twice", () => {
    expect(parseFavourites("a,b,a")).toEqual(["a", "b"]);
  });

  it("caps a hand-edited URL instead of trusting it", () => {
    const many = Array.from({ length: MAX_FAVOURITES + 20 }, (_, i) => `talk-${i}`).join(",");
    expect(parseFavourites(many)).toHaveLength(MAX_FAVOURITES);
  });

  it("round-trips a selection", () => {
    const slugs = ["a", "b", "c"];
    expect(parseFavourites(serializeFavourites(slugs))).toEqual(slugs);
  });

  it("adds and removes on toggle, keeping the order of selection", () => {
    expect(toggleFavourite(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleFavourite(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("the view parameter", () => {
  it("accepts the three views", () => {
    expect(parseView("all")).toBe("all");
    expect(parseView("mine")).toBe("mine");
    expect(parseView("mine-only")).toBe("mine-only");
  });

  it("falls back to the whole programme on anything else", () => {
    expect(parseView(undefined)).toBe("all");
    expect(parseView("favoris")).toBe("all");
  });
});
