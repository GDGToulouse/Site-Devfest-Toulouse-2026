import { describe, it, expect, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import adminSponsorRoutes from "../routes/admin/sponsors.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { createSponsorFixture, tierIdByKey } from "./sponsor-test-helpers.js";

// Minimal app for the route under test, same pattern as admin-speakers.test.ts.
async function buildSponsorsApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(adminSponsorRoutes, { prefix: "/api/admin" });
  return app;
}

const createdSponsorIds: number[] = [];

afterAll(async () => {
  if (createdSponsorIds.length > 0) {
    await prisma.sponsor.deleteMany({ where: { id: { in: createdSponsorIds } } });
  }
});

describe("POST /api/admin/sponsors/bulk — trash boundary", () => {
  it("skips a trashed sponsor caught in the selection, and still updates the live one", async () => {
    const app = await buildSponsorsApp();
    const edition = await getSeededEdition();
    const tierId = await tierIdByKey("gold");

    const live = await createSponsorFixture({
      name: `Bulk Live ${Date.now()}`,
      slug: `bulk-live-${Date.now()}`,
      editionId: edition.id,
      tierId,
      publicationStatus: "DRAFT",
    });
    const trashed = await createSponsorFixture({
      name: `Bulk Trashed ${Date.now()}`,
      slug: `bulk-trashed-${Date.now()}`,
      editionId: edition.id,
      tierId,
      publicationStatus: "DRAFT",
    });
    createdSponsorIds.push(live.id, trashed.id);

    // Trash one of the two before the bulk action runs.
    await prisma.sponsor.update({ where: { id: trashed.id }, data: { deletedAt: new Date() } });

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/sponsors/bulk",
      payload: { ids: [live.id, trashed.id], action: "setStatus", value: "PUBLISHED", editionId: edition.id },
    });
    expect(res.statusCode).toBe(200);
    // Only the live sponsor's participation was touched — the trashed one is
    // excluded from the count entirely.
    expect(res.json().count).toBe(1);

    const liveParticipation = await prisma.editionSponsor.findUnique({
      where: { sponsorId_editionId: { sponsorId: live.id, editionId: edition.id } },
    });
    const trashedParticipation = await prisma.editionSponsor.findUnique({
      where: { sponsorId_editionId: { sponsorId: trashed.id, editionId: edition.id } },
    });
    expect(liveParticipation!.publicationStatus).toBe("PUBLISHED");
    // The trash is a real boundary: a trashed sponsor's participation must not
    // be silently published by a bulk action run over a selection that
    // happens to include it.
    expect(trashedParticipation!.publicationStatus).toBe("DRAFT");

    await app.close();
  });
});
