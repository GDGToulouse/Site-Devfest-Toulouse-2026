import { describe, it, expect, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import adminSponsorRoutes from "../routes/admin/sponsors.js";
import { prisma } from "../lib/prisma.js";
import { tierIdByKey } from "./sponsor-test-helpers.js";

// #389 — attaching an existing company to an edition, from either side of the
// admin. The endpoint existed since #129 but no UI called it, so nothing
// covered it.
//
// Years 1790-1793 are this file's block, below getSeededEdition()'s 2016 floor
// so a parallel file cannot pick one up as "the current edition" (#292).

async function buildSponsorsApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(adminSponsorRoutes, { prefix: "/api/admin" });
  return app;
}

const createdSponsorIds: number[] = [];
const createdEditionIds: number[] = [];

afterEach(async () => {
  if (createdSponsorIds.length) {
    await prisma.sponsor.deleteMany({ where: { id: { in: createdSponsorIds } } });
    createdSponsorIds.length = 0;
  }
  if (createdEditionIds.length) {
    await prisma.edition.deleteMany({ where: { id: { in: createdEditionIds } } });
    createdEditionIds.length = 0;
  }
});

describe("POST /api/admin/sponsors/:id/editions (#389)", () => {
  it("freezes the tier appearance on the participation it attaches (#375)", async () => {
    const edition = await prisma.edition.create({ data: { year: 1790 } });
    createdEditionIds.push(edition.id);
    const tierId = await tierIdByKey("gold");
    const tier = await prisma.sponsorTier.findUniqueOrThrow({ where: { id: tierId } });

    const sponsor = await prisma.sponsor.create({
      data: { name: "Attach Co", slug: `attach-${Date.now()}`, logoUrl: "/logos/attach.svg" },
    });
    createdSponsorIds.push(sponsor.id);

    const app = await buildSponsorsApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/admin/sponsors/${sponsor.id}/editions`,
      payload: { editionId: edition.id, tierId },
    });
    await app.close();

    expect(res.statusCode).toBe(200);
    const participation = await prisma.editionSponsor.findFirstOrThrow({
      where: { sponsorId: sponsor.id, editionId: edition.id },
    });
    // Without this, renaming the shared catalogue would repaint the edition —
    // the very regression #375 closed on the create path.
    expect(participation.tierNameFr).toBe(tier.nameFr);
    expect(participation.tierColor).toBe(tier.color);
    expect(participation.tierLogoScale).toBe(tier.logoScale);
    // The company's current logo is all it has to start from.
    expect(participation.logoUrl).toBe("/logos/attach.svg");
    // A new participation is never published straight away.
    expect(participation.publicationStatus).toBe("DRAFT");
  });

  it("re-freezes the appearance when the same edition is attached again", async () => {
    const edition = await prisma.edition.create({ data: { year: 1791 } });
    createdEditionIds.push(edition.id);
    const goldId = await tierIdByKey("gold");
    const platinumId = await tierIdByKey("platinum");
    const platinum = await prisma.sponsorTier.findUniqueOrThrow({ where: { id: platinumId } });

    const sponsor = await prisma.sponsor.create({
      data: {
        name: "Upgraded Co",
        slug: `upgrade-${Date.now()}`,
        editions: { create: [{ editionId: edition.id, tierId: goldId, tierNameFr: "Or figé" }] },
      },
    });
    createdSponsorIds.push(sponsor.id);

    const app = await buildSponsorsApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/admin/sponsors/${sponsor.id}/editions`,
      payload: { editionId: edition.id, tierId: platinumId },
    });
    await app.close();

    expect(res.statusCode).toBe(200);
    const participation = await prisma.editionSponsor.findFirstOrThrow({
      where: { sponsorId: sponsor.id, editionId: edition.id },
    });
    // Moving to another tier must not leave the label of the one it left.
    expect(participation.tierId).toBe(platinumId);
    expect(participation.tierNameFr).toBe(platinum.nameFr);
  });

  it("rejects an unknown tier and an unknown sponsor", async () => {
    const edition = await prisma.edition.create({ data: { year: 1792 } });
    createdEditionIds.push(edition.id);
    const tierId = await tierIdByKey("gold");

    const sponsor = await prisma.sponsor.create({
      data: { name: "Guarded Co", slug: `guarded-${Date.now()}` },
    });
    createdSponsorIds.push(sponsor.id);

    const app = await buildSponsorsApp();
    const badTier = await app.inject({
      method: "POST",
      url: `/api/admin/sponsors/${sponsor.id}/editions`,
      payload: { editionId: edition.id, tierId: 999_999 },
    });
    const badSponsor = await app.inject({
      method: "POST",
      url: "/api/admin/sponsors/999999/editions",
      payload: { editionId: edition.id, tierId },
    });
    await app.close();

    expect(badTier.statusCode).toBe(422);
    expect(badSponsor.statusCode).toBe(404);
  });
});

describe("DELETE /api/admin/sponsors/:id/editions/:editionId (#389)", () => {
  it("detaches the participation and keeps the company", async () => {
    const edition = await prisma.edition.create({ data: { year: 1793 } });
    createdEditionIds.push(edition.id);
    const tierId = await tierIdByKey("gold");

    const sponsor = await prisma.sponsor.create({
      data: {
        name: "Detach Co",
        slug: `detach-${Date.now()}`,
        editions: { create: [{ editionId: edition.id, tierId }] },
      },
    });
    createdSponsorIds.push(sponsor.id);

    const app = await buildSponsorsApp();
    const res = await app.inject({
      method: "DELETE",
      url: `/api/admin/sponsors/${sponsor.id}/editions/${edition.id}`,
    });
    await app.close();

    expect(res.statusCode).toBe(204);
    expect(
      await prisma.editionSponsor.count({ where: { sponsorId: sponsor.id, editionId: edition.id } }),
    ).toBe(0);
    // The trash operates on the identity: detaching a year never removes it.
    expect(await prisma.sponsor.count({ where: { id: sponsor.id } })).toBe(1);
  });
});
