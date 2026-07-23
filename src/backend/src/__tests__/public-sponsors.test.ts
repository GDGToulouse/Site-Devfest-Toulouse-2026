import { describe, it, expect, afterEach } from "vitest";
import { buildPublicApp } from "./test-public-app.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { tierIdByKey } from "./sponsor-test-helpers.js";

// #321 — the public /api/sponsors response carries the tier object
// (key, rank, nameFr, nameEn, logoScale, color) and no longer any legacy
// `level` string; it stays ordered by tier rank (RG-221).
const createdSponsorIds: number[] = [];

afterEach(async () => {
  if (createdSponsorIds.length) {
    await prisma.sponsor.deleteMany({ where: { id: { in: createdSponsorIds } } });
    createdSponsorIds.length = 0;
  }
});

describe("Public sponsors carry the tier (#321)", () => {
  it("exposes the tier and no legacy level, ranked by tier", async () => {
    const edition = await getSeededEdition();
    const goldId = await tierIdByKey("gold");
    const platinumId = await tierIdByKey("platinum");

    // Create a gold sponsor whose name sorts before the platinum one, to prove
    // the ordering is by rank (platinum first), not by name.
    const gold = await prisma.sponsor.create({
      data: { name: "AAAA Gold Co", slug: `pub-gold-${Date.now()}`, editionId: edition.id, tierId: goldId, publicationStatus: "PUBLISHED" },
    });
    const platinum = await prisma.sponsor.create({
      data: { name: "ZZZZ Platinum Co", slug: `pub-plat-${Date.now()}`, editionId: edition.id, tierId: platinumId, publicationStatus: "PUBLISHED" },
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
