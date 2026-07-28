import { describe, it, expect, afterEach, vi } from "vitest";

import { rotateFeaturedSpeakers } from "../lib/featured-speakers.js";
import { prisma } from "../lib/prisma.js";
import { getFeaturedEdition } from "../routes/editions.js";

// The sibling unit test (lib/featured-speakers.test.ts) mocks Prisma entirely,
// so it asserts on the shape of the mock and cannot see the SQL. #351 moved the
// draw onto "SpeakerEdition": a raw query still pointing at "Speaker"."editionId"
// would have passed there while failing in production — the rotation runs from a
// cron whose errors are swallowed, so nothing would have reported it.
//
// This file runs the real query against the real schema. Only the cache purge is
// stubbed (it would try to reach the frontend over HTTP).
vi.mock("../lib/revalidate.js", () => ({ revalidateSpeakers: vi.fn().mockResolvedValue(undefined) }));

const createdIds: number[] = [];

afterEach(async () => {
  if (createdIds.length) {
    await prisma.speaker.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  }
});

async function makeSpeaker(
  editionId: number,
  name: string,
  { publicationStatus = "PUBLISHED" as const, deletedAt = null as Date | null },
) {
  const speaker = await prisma.speaker.create({
    data: {
      name,
      slug: `rotation-${name.toLowerCase().replace(/\W+/g, "-")}-${Date.now()}-${Math.round(performance.now())}`,
      deletedAt,
      editions: { create: [{ editionId, publicationStatus }] },
    },
  });
  createdIds.push(speaker.id);
  return speaker;
}

// The rotation always targets the featured edition and clears every previous
// pick on it, so assertions are scoped to the rows this file created — other
// test files share that edition and run in parallel.
async function featuredEditionId() {
  const edition = await getFeaturedEdition();
  if (!edition) throw new Error("no featured edition");
  return edition.id;
}

describe("rotateFeaturedSpeakers against the real schema (#351)", () => {
  it("only ever features published, non-trashed speakers of that edition", async () => {
    const editionId = await featuredEditionId();
    await makeSpeaker(editionId, "Rotation Published", {});

    await rotateFeaturedSpeakers();

    // Whoever won the draw, every featured row must satisfy the three criteria.
    // This is the assertion the mocked test structurally cannot make: it runs
    // the raw SQL against the real columns.
    const featured = await prisma.speakerEdition.findMany({
      where: { isFeatured: true, editionId },
      include: { speaker: { select: { deletedAt: true } } },
    });
    expect(featured.length).toBeGreaterThan(0);
    expect(featured.every((l) => l.publicationStatus === "PUBLISHED")).toBe(true);
    expect(featured.every((l) => l.speaker.deletedAt === null)).toBe(true);
  });

  it("never draws a trashed or unpublished speaker", async () => {
    const editionId = await featuredEditionId();
    const trashed = await makeSpeaker(editionId, "Rotation Trashed", { deletedAt: new Date() });
    const draft = await makeSpeaker(editionId, "Rotation Draft", { publicationStatus: "DRAFT" });

    await rotateFeaturedSpeakers();

    const links = await prisma.speakerEdition.findMany({
      where: { speakerId: { in: [trashed.id, draft.id] }, editionId },
    });
    // The pre-#351 query had no deletedAt filter: a trashed speaker could land
    // on the home page. Both must stay out of the draw.
    expect(links.every((l) => !l.isFeatured)).toBe(true);
  });

  it("clears the previous selection on that edition", async () => {
    const editionId = await featuredEditionId();
    const speaker = await makeSpeaker(editionId, "Rotation Stale", { publicationStatus: "DRAFT" });
    // Force a stale pick the draw can never re-select (it is a draft).
    await prisma.speakerEdition.updateMany({
      where: { speakerId: speaker.id, editionId },
      data: { isFeatured: true },
    });

    await rotateFeaturedSpeakers();

    const link = await prisma.speakerEdition.findUnique({
      where: { speakerId_editionId: { speakerId: speaker.id, editionId } },
    });
    expect(link!.isFeatured).toBe(false);
  });

  it("reports the edition year and at most 8 names", async () => {
    const editionId = await featuredEditionId();
    await makeSpeaker(editionId, "Rotation Reported", {});

    const result = await rotateFeaturedSpeakers();

    expect(result.edition).toBeTypeOf("number");
    expect(result.featured.length).toBeLessThanOrEqual(8);
  });
});
