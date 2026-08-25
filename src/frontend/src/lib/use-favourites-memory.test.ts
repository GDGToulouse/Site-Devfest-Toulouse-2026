import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { favouritesStorageKey, readStoredFavourites, writeStoredFavourites } from "./favourites-storage";
import { useFavouritesMemory } from "./use-favourites-memory";

// The arbitration of #461, one test per row of the issue's table.

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("arriving with no ?fav= in the URL", () => {
  it("restores the remembered selection", () => {
    writeStoredFavourites(2026, ["keynote-ouverture", "terraform-sans-douleur"]);
    const onRestore = vi.fn();

    const { result } = renderHook(() => useFavouritesMemory(2026, [], onRestore));

    // The whole point: clicking away in the menu and coming back must not cost
    // the visitor their selection.
    expect(onRestore).toHaveBeenCalledWith(["keynote-ouverture", "terraform-sans-douleur"]);
    expect(result.current.superseded).toBeNull();
  });

  it("does nothing when there is nothing to remember", () => {
    const onRestore = vi.fn();

    const { result } = renderHook(() => useFavouritesMemory(2026, [], onRestore));

    expect(onRestore).not.toHaveBeenCalled();
    expect(result.current.superseded).toBeNull();
  });

  it("does not resurrect a selection the visitor emptied", () => {
    writeStoredFavourites(2026, ["keynote-ouverture"]);
    writeStoredFavourites(2026, []);
    const onRestore = vi.fn();

    renderHook(() => useFavouritesMemory(2026, [], onRestore));

    expect(onRestore).not.toHaveBeenCalled();
  });
});

describe("arriving with a ?fav= in the URL", () => {
  it("keeps the link's selection and remembers it", () => {
    const onRestore = vi.fn();

    const { result } = renderHook(() => useFavouritesMemory(2026, ["islands-architecture"], onRestore));

    // The link wins — it is what the visitor just clicked.
    expect(onRestore).not.toHaveBeenCalled();
    expect(readStoredFavourites(2026)).toEqual(["islands-architecture"]);
    expect(result.current.superseded).toBeNull();
  });

  it("offers back the selection it replaced", () => {
    writeStoredFavourites(2026, ["keynote-ouverture", "terraform-sans-douleur"]);

    const { result } = renderHook(() => useFavouritesMemory(2026, ["islands-architecture"], vi.fn()));

    // A link from a colleague must not wipe out yesterday's work in silence.
    expect(result.current.superseded).toEqual([
      "keynote-ouverture",
      "terraform-sans-douleur",
    ]);
  });

  it("says nothing when the link carries the selection already remembered", () => {
    writeStoredFavourites(2026, ["b", "a"]);

    const { result } = renderHook(() => useFavouritesMemory(2026, ["a", "b"], vi.fn()));

    // Same selection, other order: there is nothing to bring back.
    expect(result.current.superseded).toBeNull();
  });

  it("drops the offer once it has been answered", () => {
    writeStoredFavourites(2026, ["keynote-ouverture"]);

    const { result } = renderHook(() => useFavouritesMemory(2026, ["islands-architecture"], vi.fn()));
    act(() => result.current.dismiss());

    expect(result.current.superseded).toBeNull();
  });

  it("does not offer again on a reload of the same link", () => {
    writeStoredFavourites(2026, ["keynote-ouverture"]);

    renderHook(() => useFavouritesMemory(2026, ["islands-architecture"], vi.fn()));
    // The first arrival made the link the remembered selection, so the second
    // finds them identical.
    const { result } = renderHook(() => useFavouritesMemory(2026, ["islands-architecture"], vi.fn()));

    expect(result.current.superseded).toBeNull();
  });
});

describe("when the browser refuses storage", () => {
  it("leaves the page working on the URL alone", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const onRestore = vi.fn();

    const { result } = renderHook(() => useFavouritesMemory(2026, ["a"], onRestore));

    expect(result.current.superseded).toBeNull();
    expect(onRestore).not.toHaveBeenCalled();
  });
});

describe("scoping by edition", () => {
  it("ignores another edition's selection", () => {
    localStorage.setItem(favouritesStorageKey(2025), JSON.stringify(["vieille-session"]));
    const onRestore = vi.fn();

    renderHook(() => useFavouritesMemory(2026, [], onRestore));

    expect(onRestore).not.toHaveBeenCalled();
  });
});
