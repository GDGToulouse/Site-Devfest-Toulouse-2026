import { describe, it, expect, afterEach } from "vitest";
import { buildPublicApp } from "./test-public-app.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { tierIdByKey, createSponsorFixture } from "./sponsor-test-helpers.js";

// #321 — the public /api/sponsors response carries the tier object
// (key, rank, nameFr, nameEn, logoScale, color) and no longer any legacy
// `level` string; it stays ordered by tier rank (RG-221).
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

describe("Public sponsors carry the tier (#321)", () => {
  it("exposes the tier and no legacy level, ranked by tier", async () => {
    const edition = await getSeededEdition();
    const goldId = await tierIdByKey("gold");
    const platinumId = await tierIdByKey("platinum");

    // Create a gold sponsor whose name sorts before the platinum one, to prove
    // the ordering is by rank (platinum first), not by name.
    const gold = await createSponsorFixture({
      name: "AAAA Gold Co", slug: `pub-gold-${Date.now()}`, editionId: edition.id, tierId: goldId, publicationStatus: "PUBLISHED",
    });
    const platinum = await createSponsorFixture({
      name: "ZZZZ Platinum Co", slug: `pub-plat-${Date.now()}`, editionId: edition.id, tierId: platinumId, publicationStatus: "PUBLISHED",
    });
    createdSponsorIds.push(gold.id, platinum.id);

    const app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: "/api/sponsors" });
    await app.close();

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const mine = body.filter((s: { id: number }) => s.id === gold.id || s.id === platinum.id);
    expect(mine).toHaveLength(2);

    // Every item carries the tier object (key/rank/name/color/logoScale). The
    // legacy `level` string is gone (#321).
    for (const s of mine) {
      expect(s.tier).toMatchObject({ key: expect.any(String), nameFr: expect.any(String), nameEn: expect.any(String), color: expect.any(String) });
      expect(typeof s.tier.logoScale).toBe("number");
      expect(typeof s.tier.rank).toBe("number");
      expect(s.level).toBeUndefined();
    }

    // Platinum (higher rank) comes before gold despite the name order.
    const platIdx = body.findIndex((s: { id: number }) => s.id === platinum.id);
    const goldIdx = body.findIndex((s: { id: number }) => s.id === gold.id);
    expect(platIdx).toBeLessThan(goldIdx);
    expect(body[platIdx].tier.key).toBe("platinum");
    expect(body[goldIdx].tier.key).toBe("gold");
  });
});

// #375 — the wall serves what the edition displayed, not what the company and
// the shared catalogue look like today.
describe("The sponsor wall serves the edition's frozen values (#375)", () => {
  it("prefers the participation's logo and tier label over the live ones", async () => {
    const edition = await getSeededEdition();
    const goldId = await tierIdByKey("gold");

    const sponsor = await createSponsorFixture({
      name: "Frozen Wall Co",
      slug: `pub-frozen-${Date.now()}`,
      editionId: edition.id,
      tierId: goldId,
      publicationStatus: "PUBLISHED",
      // The company's current logo — what the wall must NOT show.
      logoUrl: "/logos/current.svg",
    });
    createdSponsorIds.push(sponsor.id);

    await prisma.editionSponsor.updateMany({
      where: { sponsorId: sponsor.id, editionId: edition.id },
      data: { logoUrl: "/logos/that-year.svg", tierNameFr: "Or de 2026", tierColor: "#d4af37" },
    });

    const app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: "/api/sponsors" });
    await app.close();

    expect(res.statusCode).toBe(200);
    const mine = res.json().find((s: { id: number }) => s.id === sponsor.id);
    expect(mine.logoUrl).toBe("/logos/that-year.svg");
    expect(mine.tier.nameFr).toBe("Or de 2026");
    expect(mine.tier.color).toBe("#d4af37");
    // Not frozen: key and rank drive grouping and ordering, so they stay live.
    expect(mine.tier.key).toBe("gold");
  });

  it("falls back to the company's logo when the edition froze none", async () => {
    const edition = await getSeededEdition();
    const goldId = await tierIdByKey("gold");

    // createSponsorFixture sets logoUrl on the identity only, so the
    // participation carries null — a row created before #375 looks like this.
    const sponsor = await createSponsorFixture({
      name: "Fallback Wall Co",
      slug: `pub-fallback-${Date.now()}`,
      editionId: edition.id,
      tierId: goldId,
      publicationStatus: "PUBLISHED",
      logoUrl: "/logos/identity.svg",
    });
    createdSponsorIds.push(sponsor.id);

    const app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: "/api/sponsors" });
    await app.close();

    const live = await prisma.sponsorTier.findUniqueOrThrow({ where: { id: goldId } });
    const mine = res.json().find((s: { id: number }) => s.id === sponsor.id);
    expect(mine.logoUrl).toBe("/logos/identity.svg");
    expect(mine.tier.nameFr).toBe(live.nameFr);
  });
});

// #379 — the sitemap needs every company that HAS a page, which is not the same
// set as the featured edition's wall. Getting this wrong silently drops the
// historical sponsors from indexing while their pages answer 200.
describe("Indexable sponsors span every edition (#379)", () => {
  it("lists a sponsor of a past edition that the featured wall omits", async () => {
    const past = await prisma.edition.create({ data: { year: 1762 } });
    createdEditionIds.push(past.id);
    const tierId = await tierIdByKey("gold");
    const sponsor = await createSponsorFixture({
      name: "Sitemap Past Co",
      slug: `sitemap-past-${Date.now()}`,
      editionId: past.id,
      tierId,
      publicationStatus: "PUBLISHED",
    });
    createdSponsorIds.push(sponsor.id);

    const app = await buildPublicApp();
    const [indexable, wall, detail] = await Promise.all([
      app.inject({ method: "GET", url: "/api/sponsors/indexable" }),
      app.inject({ method: "GET", url: "/api/sponsors" }),
      app.inject({ method: "GET", url: `/api/sponsors/${sponsor.slug}` }),
    ]);
    await app.close();

    // The page exists, so the sitemap must list it...
    expect(detail.statusCode).toBe(200);
    expect(indexable.json().map((s: { slug: string }) => s.slug)).toContain(sponsor.slug);
    // ...even though it is absent from the featured wall. This gap is the bug.
    expect(wall.json().map((s: { slug: string }) => s.slug)).not.toContain(sponsor.slug);
  });

  it("omits a sponsor with no published participation", async () => {
    const past = await prisma.edition.create({ data: { year: 1763 } });
    createdEditionIds.push(past.id);
    const tierId = await tierIdByKey("gold");
    const sponsor = await createSponsorFixture({
      name: "Sitemap Draft Co",
      slug: `sitemap-draft-${Date.now()}`,
      editionId: past.id,
      tierId,
      publicationStatus: "DRAFT",
    });
    createdSponsorIds.push(sponsor.id);

    const app = await buildPublicApp();
    const [indexable, detail] = await Promise.all([
      app.inject({ method: "GET", url: "/api/sponsors/indexable" }),
      app.inject({ method: "GET", url: `/api/sponsors/${sponsor.slug}` }),
    ]);
    await app.close();

    // Symmetry with the route: no page, no sitemap entry.
    expect(detail.statusCode).toBe(404);
    expect(indexable.json().map((s: { slug: string }) => s.slug)).not.toContain(sponsor.slug);
  });

  it("carries a real modification date, not the moment of the request", async () => {
    const edition = await getSeededEdition();
    const tierId = await tierIdByKey("gold");
    const sponsor = await createSponsorFixture({
      name: "Sitemap Dated Co",
      slug: `sitemap-dated-${Date.now()}`,
      editionId: edition.id,
      tierId,
      publicationStatus: "PUBLISHED",
    });
    createdSponsorIds.push(sponsor.id);

    const app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: "/api/sponsors/indexable" });
    await app.close();

    const mine = res.json().find((s: { slug: string }) => s.slug === sponsor.slug);
    // A `lastmod` that always equals "now" carries no information at all, which
    // is what the sitemap used to send.
    expect(mine.updatedAt).toBeTruthy();
    expect(new Date(mine.updatedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});

// Years 1760 to 1763 are reserved for this file's past-edition fixtures.
// All sit below getSeededEdition()'s 2016 floor, so parallel test files
// cannot pick them up as "the current edition" (#292).
describe("Sponsor detail spans editions (#129)", () => {
  it("serves a sponsor of a past edition with no tier and no offers, even if it had one", async () => {
    const past = await prisma.edition.create({ data: { year: 1760 } });
    const pastAgain = await prisma.edition.create({ data: { year: 1761 } });
    const tierId = await tierIdByKey("gold");
    const sponsor = await createSponsorFixture({
      name: "Past Only Co",
      slug: `past-only-${Date.now()}`,
      editionId: past.id,
      tierId,
      publicationStatus: "PUBLISHED",
    });
    createdSponsorIds.push(sponsor.id);
    createdEditionIds.push(past.id, pastAgain.id);

    // A second past participation, ordered newest-first below.
    await prisma.editionSponsor.create({
      data: { sponsorId: sponsor.id, editionId: pastAgain.id, tierId, publicationStatus: "PUBLISHED" },
    });

    // Even a past edition can carry a job offer in the data (e.g. never
    // cleaned up) — the rule is "no past offer is ever shown", not "past
    // sponsors never had offers". Prove the filter actually holds.
    const pastParticipation = await prisma.editionSponsor.findUniqueOrThrow({
      where: { sponsorId_editionId: { sponsorId: sponsor.id, editionId: past.id } },
      select: { id: true },
    });
    await prisma.sponsorJobOffer.create({
      data: { editionSponsorId: pastParticipation.id, title: "Old role", url: "https://example.org/old-job" },
    });

    const app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: `/api/sponsors/${sponsor.slug}` });
    await app.close();

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Not sponsoring the featured edition: highlight is empty, history remains.
    expect(body.tier).toBeNull();
    expect(body.jobOffers).toEqual([]);
    // Newest first, unpinned by fixture insertion order.
    expect(body.editions).toEqual([1761, 1760]);
  });

  it("highlights the tier of the featured edition", async () => {
    const edition = await getSeededEdition();
    const tierId = await tierIdByKey("platinum");
    const sponsor = await createSponsorFixture({
      name: "Current Co",
      slug: `current-${Date.now()}`,
      editionId: edition.id,
      tierId,
      publicationStatus: "PUBLISHED",
    });
    createdSponsorIds.push(sponsor.id);

    const app = await buildPublicApp();
    const res = await app.inject({ method: "GET", url: `/api/sponsors/${sponsor.slug}` });
    await app.close();

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Full tier shape (RG-221 banner colour / logo size), not just the key.
    expect(body.tier).toMatchObject({
      key: "platinum",
      nameFr: expect.any(String),
      nameEn: expect.any(String),
      color: expect.any(String),
    });
    expect(typeof body.tier.logoScale).toBe("number");
    expect(typeof body.tier.rank).toBe("number");
    expect(body.editions).toContain(edition.year);
  });
});
