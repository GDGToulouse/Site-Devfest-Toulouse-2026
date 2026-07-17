import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "../lib/prisma.js";
import { importSessionize } from "../lib/sessionize-import.js";

// Integration coverage for the Sessionize category mapping fixes (#247):
// Language drives talk.language (no bogus category), "Avancé" maps to CONFIRME,
// "Workshop" maps to the new WORKSHOP format, and an unrecognized format item
// surfaces a warning instead of being lost silently. Runs against the test DB
// on a throwaway edition that is deleted afterwards.

const TEST_YEAR = 2099;

// Item ids referenced by the sessions below.
const FMT_WORKSHOP = 101;
const FMT_UNKNOWN = 102;
const LEVEL_AVANCE = 201;
const LANG_EN = 301;
const TRACK_CLOUD = 401;

const payload = {
  speakers: [],
  categories: [
    { id: 1, title: "Session format", items: [
      { id: FMT_WORKSHOP, name: "Workshop" },
      { id: FMT_UNKNOWN, name: "Fireside chat" },
    ] },
    { id: 2, title: "Niveau", items: [{ id: LEVEL_AVANCE, name: "Avancé" }] },
    { id: 3, title: "Language", items: [{ id: LANG_EN, name: "English" }] },
    { id: 4, title: "Track", items: [{ id: TRACK_CLOUD, name: "Cloud & DevOps 2099" }] },
  ],
  sessions: [
    { id: "s1", title: "Workshop avancé en anglais 2099",
      categoryItems: [FMT_WORKSHOP, LEVEL_AVANCE, LANG_EN, TRACK_CLOUD] },
    { id: "s2", title: "Session au format inconnu 2099",
      categoryItems: [FMT_UNKNOWN, TRACK_CLOUD] },
  ],
};

describe("importSessionize category mapping (#247)", () => {
  afterAll(async () => {
    const edition = await prisma.edition.findUnique({ where: { year: TEST_YEAR } });
    if (edition) {
      await prisma.talk.deleteMany({ where: { editionId: edition.id } });
      await prisma.category.deleteMany({ where: { editionId: edition.id } });
      await prisma.edition.delete({ where: { id: edition.id } });
    }
  });

  it("maps workshop / avancé / language and warns on an unknown format", async () => {
    const edition = await prisma.edition.create({
      data: { year: TEST_YEAR, status: "PREPARATION" },
    });

    const report = await importSessionize(edition.id, payload);

    const talks = await prisma.talk.findMany({
      where: { editionId: edition.id },
      include: { category: true },
      orderBy: { slug: "asc" },
    });

    const workshop = talks.find((t) => t.titleFr.includes("Workshop avancé"));
    expect(workshop?.format).toBe("WORKSHOP");
    expect(workshop?.level).toBe("CONFIRME");
    expect(workshop?.language).toBe("en");
    expect(workshop?.category?.nameFr).toBe("Cloud & DevOps 2099");

    // The "Language" category must NOT become a track category.
    const categories = await prisma.category.findMany({ where: { editionId: edition.id } });
    expect(categories.map((c) => c.nameFr)).toEqual(["Cloud & DevOps 2099"]);

    // Unknown format falls back to CONFERENCE and is reported.
    const fallback = talks.find((t) => t.titleFr.includes("format inconnu"));
    expect(fallback?.format).toBe("CONFERENCE");
    expect(report.warnings.some((w) => w.includes("Fireside chat"))).toBe(true);
  });
});
