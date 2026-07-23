import { describe, it, expect, afterEach } from "vitest";
import { buildPublicApp } from "./test-public-app.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { tierIdByKey } from "./sponsor-test-helpers.js";

// #318 — the public /api/sponsors response now carries the real tier object
// (nameFr, nameEn, logoScale, color) alongside the legacy `level` shim (#317),
// and stays ordered by tier rank (RG-221).
const createdSponsorIds: number[] = [];

afterEach(async () => {
  if (createdSponsorIds.length) {
    await prisma.sponsor.deleteMany({ where: { id: { in: createdSponsorIds } } });
    createdSponsorIds.length = 0;
  }
});

describe("Public sponsors carry tier + level (#318)", () => {
  it("exposes tier and level, ranked by tier", async () => {
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

    // Every item carries the tier object AND the legacy level string.
    for (const s of mine) {
      expect(s.tier).toMatchObject({ nameFr: expect.any(String), nameEn: expect.any(String), color: expect.any(String) });
      expect(typeof s.tier.logoScale).toBe("number");
      expect(typeof s.level).toBe("string");
    }

    // Platinum (higher rank) comes before gold despite the name order.
    const platIdx = body.findIndex((s: { id: number }) => s.id === platinum.id);
    const goldIdx = body.findIndex((s: { id: number }) => s.id === gold.id);
    expect(platIdx).toBeLessThan(goldIdx);
    expect(body[platIdx].level).toBe("PLATINUM");
    expect(body[goldIdx].level).toBe("GOLD");
  });
});
