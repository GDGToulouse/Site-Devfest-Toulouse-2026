import { describe, it, expect } from "vitest";

import { pageFiles } from "./file-list.js";

const file = (name: string, ext: string, isImage: boolean, usages: unknown[] = [], tags: string[] = []) => ({
  name,
  filename: `1700000000000-${name}${ext}`,
  originalName: null as string | null,
  alt: null as string | null,
  ext,
  isImage,
  usages,
  tags: tags.map((slug) => ({ slug, name: slug })),
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

describe("pageFiles search (#768)", () => {
  const SEARCHABLE = [
    { ...file("photo", ".jpg", true), originalName: "Photo-Diagora-2025.jpg", alt: "Le hall du Diagora" },
    { ...file("old", ".png", true), alt: "Keynote d'ouverture" },
    { ...file("plan", ".pdf", false), originalName: "Plan-accès.pdf" },
    { ...file("logo", ".svg", true, [{ model: "Speaker" }]), originalName: "logo.svg", tags: [{ slug: "securite", name: "Sécurité" }] },
  ];
  const search = (text: string, fields: ("name" | "alt" | "tags")[] = ["name"]) =>
    pageFiles(SEARCHABLE, { page: 1, limit: 10, search: { text, fields } }).items.map((f) => f.name);

  it("finds a file by part of its original name, whatever the case", () => {
    expect(search("diagora")).toEqual(["photo"]);
  });

  it("ignores accents on either side", () => {
    expect(search("ACCES")).toEqual(["plan"]);
    expect(search("accès")).toEqual(["plan"]);
  });

  it("falls back to the stored name for a file uploaded without one", () => {
    expect(search("1700000000000-old")).toEqual(["old"]);
  });

  it("does not look at the stored name when there is an original one", () => {
    expect(search("1700000000000-photo")).toEqual([]);
  });

  it("looks in the alt text only when asked", () => {
    expect(search("keynote")).toEqual([]);
    expect(search("keynote", ["name", "alt"])).toEqual(["old"]);
  });

  it("looks in the tags' names only when asked", () => {
    expect(search("securite")).toEqual([]);
    expect(search("securite", ["name", "tags"])).toEqual(["logo"]);
  });

  it("matches a file when any chosen field does", () => {
    expect(search("diagora", ["name", "alt"])).toEqual(["photo"]);
  });

  it("treats a blank search as no search", () => {
    expect(search("   ")).toHaveLength(4);
  });

  it("combines with the type tab and the tag, and the counts follow the search", () => {
    const res = pageFiles(SEARCHABLE, {
      page: 1,
      limit: 10,
      type: "images",
      tag: "securite",
      search: { text: "logo", fields: ["name"] },
    });
    const byText = pageFiles(SEARCHABLE, { page: 1, limit: 10, type: "images", search: { text: "a", fields: ["name"] } });

    expect(res.items.map((f) => f.name)).toEqual(["logo"]);
    expect(byText.counts).toEqual({ all: 2, images: 1, documents: 1, unused: 2 });
  });
});
