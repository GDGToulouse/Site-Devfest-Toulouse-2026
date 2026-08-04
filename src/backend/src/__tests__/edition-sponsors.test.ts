import { describe, it, expect, afterEach } from "vitest";

import { buildApp } from "./test-app.js";
import { prisma } from "../lib/prisma.js";
import { tierIdByKey } from "./sponsor-test-helpers.js";

// #370 — a past edition's sponsors, which /api/sponsors cannot serve: it scopes
// to the featured edition, so a past year comes back empty.
//
// Years 1780-1783 are this file's block. All sit below getSeededEdition()'s 2016
// floor, so a parallel test file cannot pick one up as "the current edition"
// (#292).

const createdSponsorIds: number[] = [];
const createdEditionIds: number[] = [];

afterEach(async () => {
  if (createdSponsorIds.length) {
    // EditionSponsor cascades from Sponsor: delete sponsors first, so their
    // participations are gone before the edition they point at.
    await prisma.sponsor.deleteMany({ where: { id: { in: createdSponsorIds } } });
    createdSponsorIds.length = 0;
  }
  if (createdEditionIds.length) {
    await prisma.edition.deleteMany({ where: { id: { in: createdEditionIds } } });
    createdEditionIds.length = 0;
  }
});

describe("GET /api/editions/:year/sponsors (#370)", () => {
  it("serves the published sponsors of a past edition, ranked by tier", async () => {
    const past = await prisma.edition.create({ data: { year: 1780 } });
    createdEditionIds.push(past.id);
    const goldId = await tierIdByKey("gold");
    const platinumId = await tierIdByKey("platinum");

    // The gold name sorts before the platinum one, to prove the order comes
    // from the tier rank (platinum first) and not from the name.
    const gold = await prisma.sponsor.create({
      data: {
        name: "AAAA Gold Past Co",
        slug: `past-gold-${Date.now()}`,
        editions: { create: [{ editionId: past.id, tierId: goldId, publicationStatus: "PUBLISHED" }] },
      },
    });
    const platinum = await prisma.sponsor.create({
      data: {
        name: "ZZZZ Platinum Past Co",
        slug: `past-plat-${Date.now()}`,
        editions: { create: [{ editionId: past.id, tierId: platinumId, publicationStatus: "PUBLISHED" }] },
      },
    });
    createdSponsorIds.push(gold.id, platinum.id);

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/editions/1780/sponsors" });
    await app.close();

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body[0].slug).toBe(platinum.slug);
    expect(body[1].slug).toBe(gold.slug);
    // Same payload as /api/sponsors, so both walls share a component and a type.
    expect(body[0]).toMatchObject({
      id: platinum.id,
      name: "ZZZZ Platinum Past Co",
      tier: { key: "platinum" },
    });
  });

  it("excludes a draft participation and a trashed sponsor", async () => {
    const past = await prisma.edition.create({ data: { year: 1781 } });
    createdEditionIds.push(past.id);
    const tierId = await tierIdByKey("gold");

    const draft = await prisma.sponsor.create({
      data: {
        name: "Draft Past Co",
        slug: `past-draft-${Date.now()}`,
        editions: { create: [{ editionId: past.id, tierId, publicationStatus: "DRAFT" }] },
      },
    });
    const trashed = await prisma.sponsor.create({
      data: {
        name: "Trashed Past Co",
        slug: `past-trashed-${Date.now()}`,
        deletedAt: new Date(),
        editions: { create: [{ editionId: past.id, tierId, publicationStatus: "PUBLISHED" }] },
      },
    });
    createdSponsorIds.push(draft.id, trashed.id);

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/editions/1781/sponsors" });
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("serves what the edition displayed, not the live values (#375)", async () => {
    const past = await prisma.edition.create({ data: { year: 1782 } });
    createdEditionIds.push(past.id);
    const tierId = await tierIdByKey("gold");

    const sponsor = await prisma.sponsor.create({
      data: {
        name: "Rebranded Past Co",
        slug: `past-frozen-${Date.now()}`,
        // The company's current logo — what the archive must NOT show.
        logoUrl: "/logos/today.svg",
        editions: {
          create: [{
            editionId: past.id,
            tierId,
            publicationStatus: "PUBLISHED",
            logoUrl: "/logos/back-then.svg",
            tierNameFr: "Or de 1782",
            tierColor: "#d4af37",
          }],
        },
      },
    });
    createdSponsorIds.push(sponsor.id);

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/editions/1782/sponsors" });
    await app.close();

    const [served] = res.json();
    expect(served.logoUrl).toBe("/logos/back-then.svg");
    expect(served.tier.nameFr).toBe("Or de 1782");
    expect(served.tier.color).toBe("#d4af37");
    // Not frozen: key and rank drive grouping and ordering, so they stay live.
    expect(served.tier.key).toBe("gold");
  });

  it("returns an empty list for an edition without sponsors", async () => {
    const past = await prisma.edition.create({ data: { year: 1783 } });
    createdEditionIds.push(past.id);

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/editions/1783/sponsors" });
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns 404 for an unknown year and 400 for a non-numeric one", async () => {
    const app = await buildApp();
    const missing = await app.inject({ method: "GET", url: "/api/editions/1799/sponsors" });
    const invalid = await app.inject({ method: "GET", url: "/api/editions/not-a-year/sponsors" });
    await app.close();

    expect(missing.statusCode).toBe(404);
    expect(invalid.statusCode).toBe(400);
  });
});
