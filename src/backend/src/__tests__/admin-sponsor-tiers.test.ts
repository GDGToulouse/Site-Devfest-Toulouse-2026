import { describe, it, expect, afterEach } from "vitest";
import { buildAdminApp } from "./test-admin-app.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { createSponsorFixture, tierIdByKey } from "./sponsor-test-helpers.js";

// #318 — CRUD of the global sponsoring-tier catalogue. Teardown is scoped to the
// rows this file created (its keys are prefixed so they never clash with the
// seeded catalogue read by other parallel files).
const createdTierIds: number[] = [];

afterEach(async () => {
  if (createdTierIds.length) {
    await prisma.sponsorTier.deleteMany({ where: { id: { in: createdTierIds } } });
    createdTierIds.length = 0;
  }
});

async function createTier(overrides: Record<string, unknown> = {}) {
  const app = await buildAdminApp();
  const res = await app.inject({
    method: "POST",
    url: "/api/admin/sponsor-tiers",
    payload: { key: `test-tier-${Date.now()}-${Math.round(performance.now())}`, nameFr: "Test", nameEn: "Test", ...overrides },
  });
  await app.close();
  if (res.statusCode === 201) createdTierIds.push(res.json().id);
  return res;
}

describe("Admin Sponsor Tiers API (#318)", () => {
  it("lists tiers sorted by rank desc with advantages as an array", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/sponsor-tiers" });
    await app.close();

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    // The seeded catalogue leads with platinum (rank 40).
    expect(body[0].key).toBe("platinum");
    const ranks = body.map((t: { rank: number }) => t.rank);
    expect([...ranks]).toEqual([...ranks].sort((a, b) => b - a));
    // advantages is deserialized, never the raw JSON string.
    expect(Array.isArray(body[0].advantages)).toBe(true);
  });

  it("creates a tier and reads it back with advantages re-parsed", async () => {
    const create = await createTier({
      nameFr: "Créé", nameEn: "Created", rank: 5, jobOfferQuota: 3, allowsPromoIdeas: true,
      advantages: [{ fr: "Un", en: "One" }],
    });
    expect(create.statusCode).toBe(201);
    const { id } = create.json();

    const stored = await prisma.sponsorTier.findUnique({ where: { id } });
    expect(stored?.nameFr).toBe("Créé");
    expect(stored?.rank).toBe(5);
    expect(stored?.jobOfferQuota).toBe(3);
    expect(stored?.allowsPromoIdeas).toBe(true);
    // Stored as a JSON string; the create response returns it parsed.
    expect(JSON.parse(stored?.advantages ?? "[]")).toEqual([{ fr: "Un", en: "One" }]);
    expect(create.json().advantages).toEqual([{ fr: "Un", en: "One" }]);
  });

  it("rejects a duplicate key with 409", async () => {
    const key = `dup-${Date.now()}`;
    const first = await createTier({ key });
    expect(first.statusCode).toBe(201);

    const app = await buildAdminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/sponsor-tiers",
      payload: { key, nameFr: "X", nameEn: "X" },
    });
    await app.close();
    expect(res.statusCode).toBe(409);
  });

  it("rejects a create missing key/nameFr/nameEn with 400", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/sponsor-tiers",
      payload: { nameFr: "Sans clé" },
    });
    await app.close();
    expect(res.statusCode).toBe(400);
  });

  it("applies a PUT to the stored row", async () => {
    const { id } = (await createTier({ nameFr: "Avant" })).json();
    const app = await buildAdminApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/sponsor-tiers/${id}`,
      payload: { nameFr: "Après", color: "#123456", rank: 99 },
    });
    await app.close();
    expect(res.statusCode).toBe(200);

    const stored = await prisma.sponsorTier.findUnique({ where: { id } });
    expect(stored?.nameFr).toBe("Après");
    expect(stored?.color).toBe("#123456");
    expect(stored?.rank).toBe(99);
  });

  it("soft-deletes a tier and parks its key", async () => {
    const key = `del-${Date.now()}`;
    const { id } = (await createTier({ key })).json();

    const app = await buildAdminApp();
    const del = await app.inject({ method: "DELETE", url: `/api/admin/sponsor-tiers/${id}` });
    await app.close();
    expect(del.statusCode).toBe(204);

    const stored = await prisma.sponsorTier.findUnique({ where: { id } });
    expect(stored?.deletedAt).not.toBeNull();
    // key is parked so a new tier could reuse the readable value.
    expect(stored?.key).not.toBe(key);
    expect(stored?.key.startsWith("__trash_")).toBe(true);

    // No longer in the live listing.
    const listApp = await buildAdminApp();
    const list = await listApp.inject({ method: "GET", url: "/api/admin/sponsor-tiers" });
    await listApp.close();
    expect(list.json().some((t: { id: number }) => t.id === id)).toBe(false);
  });

  it("refuses to delete a tier still bound to an edition (409)", async () => {
    // The seeded platinum tier has an EditionSponsorTier link → cannot be trashed.
    const platinumId = await tierIdByKey("platinum");
    const app = await buildAdminApp();
    const del = await app.inject({ method: "DELETE", url: `/api/admin/sponsor-tiers/${platinumId}` });
    await app.close();
    expect(del.statusCode).toBe(409);

    // And it stays live.
    const stored = await prisma.sponsorTier.findUnique({ where: { id: platinumId } });
    expect(stored?.deletedAt).toBeNull();
  });

  it("refuses to delete a tier still used by a live sponsor (409)", async () => {
    const edition = await getSeededEdition();
    const { id } = (await createTier({ key: `used-${Date.now()}` })).json();
    const sponsor = await createSponsorFixture({
      name: "Tier User", slug: `tier-user-${Date.now()}`, editionId: edition.id, tierId: id,
    });

    const app = await buildAdminApp();
    const del = await app.inject({ method: "DELETE", url: `/api/admin/sponsor-tiers/${id}` });
    await app.close();
    expect(del.statusCode).toBe(409);

    await prisma.sponsor.delete({ where: { id: sponsor.id } });
  });
});
