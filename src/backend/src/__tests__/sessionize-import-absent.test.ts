import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma.js";
import { importSessionize } from "../lib/sessionize-import.js";

// A speaker who withdraws disappears from Sessionize, but the import only walks
// what the payload holds: the report must list what the site still has and
// Sessionize no longer does, and change none of it (#509).

// A past year, for the reason given in sessionize-import-mapping.test.ts (#292).
const TEST_YEAR = 1997;

const kept = { id: "sz-kept", fullName: "Gardée Absent 1997" };
const gone = { id: "sz-gone", fullName: "Partie Absent 1997" };

function payload(speakers: Array<{ id: string; fullName: string }>, sessions: Array<{ id: string; title: string; speakers: string[] }>) {
  return { speakers, sessions, categories: [] };
}

const full = payload(
  [kept, gone],
  [
    { id: "s1", title: "Session gardée 1997", speakers: [kept.id] },
    { id: "s2", title: "Session annulée 1997", speakers: [gone.id] },
  ],
);
const withoutWithdrawal = payload([kept], [{ id: "s1", title: "Session gardée 1997", speakers: [kept.id] }]);

let editionId: number;

describe("importSessionize absent from Sessionize (#509)", () => {
  beforeAll(async () => {
    const edition = await prisma.edition.create({ data: { year: TEST_YEAR } });
    editionId = edition.id;
  });

  afterAll(async () => {
    await prisma.talk.deleteMany({ where: { editionId } });
    await prisma.edition.delete({ where: { id: editionId } });
    await prisma.speaker.deleteMany({ where: { name: { in: [kept.fullName, gone.fullName] } } });
  });

  it("should report nothing when the payload still holds everything", async () => {
    await importSessionize(editionId, full);
    const report = await importSessionize(editionId, full);

    expect(report.absent).toEqual({ talks: [], speakers: [] });
  });

  it("should list a withdrawn talk and speaker without changing them", async () => {
    const cancelled = await prisma.talk.findFirstOrThrow({ where: { editionId, title: "Session annulée 1997" } });
    await prisma.talk.update({
      where: { id: cancelled.id },
      data: { publicationStatus: "PUBLISHED", startsAt: new Date("1997-11-19T09:00:00Z"), roomLabel: "Pastel" },
    });
    const participation = await prisma.speakerEdition.findFirstOrThrow({
      where: { editionId, speaker: { name: gone.fullName } },
    });
    await prisma.speakerEdition.update({ where: { id: participation.id }, data: { publicationStatus: "PUBLISHED" } });

    const report = await importSessionize(editionId, withoutWithdrawal);

    expect(report.absent.talks).toEqual([
      {
        id: cancelled.id,
        title: "Session annulée 1997",
        publicationStatus: "PUBLISHED",
        startsAt: "1997-11-19T09:00:00.000Z",
        roomLabel: "Pastel",
      },
    ]);
    expect(report.absent.speakers).toEqual([
      { id: participation.speakerId, name: gone.fullName, publicationStatus: "PUBLISHED" },
    ]);
    const after = await prisma.talk.findUniqueOrThrow({ where: { id: cancelled.id } });
    expect(after.publicationStatus).toBe("PUBLISHED");
    expect(after.startsAt?.toISOString()).toBe("1997-11-19T09:00:00.000Z");
  });

  it("should leave a trashed talk out of the list", async () => {
    await prisma.talk.updateMany({ where: { editionId, title: "Session annulée 1997" }, data: { deletedAt: new Date() } });

    const report = await importSessionize(editionId, withoutWithdrawal);

    expect(report.absent.talks).toEqual([]);
  });
});
