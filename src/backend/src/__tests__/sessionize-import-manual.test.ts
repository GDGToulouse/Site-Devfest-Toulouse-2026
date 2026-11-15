import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma.js";
import { importSessionize } from "../lib/sessionize-import.js";

// Talks entered by hand in the admin, outside Sessionize (#828): the import
// matches talks by the slug of their title, so it used to rewrite one whose
// title a Sessionize session shared, and listed the others as absent.

// A past year, for the reason given in sessionize-import-mapping.test.ts (#292).
const TEST_YEAR = 1828;

const speaker = { id: "sz-manual-1828", fullName: "Speaker Sessionize 1828" };

const payload = {
  speakers: [speaker],
  sessions: [
    { id: "s1", title: "Session Sessionize 1828", description: "De Sessionize", speakers: [speaker.id] },
    { id: "s2", title: "Atelier saisi à la main 1828", description: "Version Sessionize", speakers: [speaker.id] },
  ],
  categories: [],
};

let editionId: number;
let collidingId: number;
let aloneId: number;

describe("importSessionize and talks entered by hand (#828)", () => {
  beforeAll(async () => {
    const edition = await prisma.edition.create({ data: { year: TEST_YEAR } });
    editionId = edition.id;
    const colliding = await prisma.talk.create({
      data: {
        editionId,
        slug: "atelier-saisi-a-la-main-1828",
        title: "Atelier saisi à la main 1828",
        description: "Version de l'admin",
        format: "WORKSHOP",
        language: "fr",
        isManual: true,
        startsAt: new Date("1828-11-19T13:00:00Z"),
      },
    });
    collidingId = colliding.id;
    const alone = await prisma.talk.create({
      data: {
        editionId,
        slug: "table-ronde-1828",
        title: "Table ronde 1828",
        description: "",
        format: "CONFERENCE",
        language: "fr",
        isManual: true,
      },
    });
    aloneId = alone.id;
  });

  afterAll(async () => {
    if (editionId !== undefined) {
      await prisma.talk.deleteMany({ where: { editionId } });
      await prisma.edition.delete({ where: { id: editionId } });
    }
    await prisma.speaker.deleteMany({ where: { name: speaker.fullName } });
  });

  it("should leave a hand-entered talk untouched when a session shares its title", async () => {
    const report = await importSessionize(editionId, payload);

    const after = await prisma.talk.findUniqueOrThrow({ where: { id: collidingId }, include: { speakers: true } });
    expect(after).toMatchObject({
      description: "Version de l'admin",
      format: "WORKSHOP",
      startsAt: new Date("1828-11-19T13:00:00Z"),
    });
    expect(after.speakers).toEqual([]);
    expect(report.talks).toMatchObject({ created: 1, updated: 0, skippedManual: 1 });
  });

  it("should not create a duplicate of the skipped session", async () => {
    const count = await prisma.talk.count({ where: { editionId, title: "Atelier saisi à la main 1828" } });

    expect(count).toBe(1);
  });

  it("should name the skipped session in the warnings", async () => {
    const report = await importSessionize(editionId, payload);

    expect(report.warnings).toContain(
      "Session « Atelier saisi à la main 1828 » ignorée : la conférence du même titre est saisie à la main sur le site.",
    );
  });

  it("should not list hand-entered talks as absent from Sessionize", async () => {
    const report = await importSessionize(editionId, payload);

    expect(report.absent.talks.map((t) => t.id)).not.toContain(aloneId);
    expect(report.absent.talks.map((t) => t.id)).not.toContain(collidingId);
  });

  it("should still update an unmarked talk with the same title", async () => {
    await prisma.talk.update({ where: { id: collidingId }, data: { isManual: false } });

    const report = await importSessionize(editionId, payload);

    const after = await prisma.talk.findUniqueOrThrow({ where: { id: collidingId } });
    expect(after.description).toBe("Version Sessionize");
    expect(report.talks.skippedManual).toBe(0);
  });
});
