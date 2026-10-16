import { describe, it, expect } from "vitest";

import { pageFiles } from "./file-list.js";

const file = (name: string, ext: string, isImage: boolean, usages: unknown[] = [], tags: string[] = []) => ({
  name,
  ext,
  isImage,
  usages,
  tags: tags.map((slug) => ({ slug })),
});

const LIBRARY = [
  file("a", ".png", true, [{ model: "Speaker" }], ["logos"]),
  file("b", ".jpg", true, [], ["logos", "photos-2024"]),
  file("c", ".pdf", false),
  file("d", ".PDF", false, [{ model: "EditionSponsor" }]),
  file("e", ".webp", true),
];

describe("pageFiles (#416)", () => {
  it("returns one page in the given order, with the total of the tab", () => {
    const res = pageFiles(LIBRARY, { page: 2, limit: 2 });

    expect(res.items.map((f) => f.name)).toEqual(["c", "d"]);
    expect(res).toMatchObject({ page: 2, limit: 2, total: 5 });
  });

  it("counts every tab, whichever one is open", () => {
    const res = pageFiles(LIBRARY, { page: 1, limit: 10, type: "unused" });

    expect(res.items.map((f) => f.name)).toEqual(["b", "c", "e"]);
    expect(res.counts).toEqual({ all: 5, images: 3, documents: 2, unused: 3 });
  });

  it("keeps a picker to the extensions it accepts, counts included", () => {
    const res = pageFiles(LIBRARY, { page: 1, limit: 10, extensions: [".pdf"] });

    expect(res.items.map((f) => f.name)).toEqual(["c", "d"]);
    expect(res.counts.all).toBe(2);
  });

  // #373: a tag narrows the library itself, counts included; "none" finds the
  // files still to sort.
  it("narrows to a tag, or to the untagged files", () => {
    const tagged = pageFiles(LIBRARY, { page: 1, limit: 10, tag: "logos" });
    const untagged = pageFiles(LIBRARY, { page: 1, limit: 10, tag: "none" });

    expect(tagged.items.map((f) => f.name)).toEqual(["a", "b"]);
    expect(tagged.counts).toEqual({ all: 2, images: 2, documents: 0, unused: 1 });
    expect(untagged.items.map((f) => f.name)).toEqual(["c", "d", "e"]);
  });

  it("caps the page size so a page cannot be the whole library", () => {
    expect(pageFiles(LIBRARY, { page: 1, limit: 100_000 }).limit).toBe(200);
  });
});
