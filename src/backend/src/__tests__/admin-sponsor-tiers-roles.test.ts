process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";
process.env.LOG_LEVEL = "silent";

import { describe, it, expect, afterAll, vi } from "vitest";

// #521 — the sponsoring offers commit the association (price, job-offer quota,
// Platinum options): writing them is an ADMIN's call. Editors still read the
// catalogue, since the sponsor form picks a tier from it. The auth context is
// stubbed and the real server built, so the guard tested is the one the server
// registers.
const authContext = vi.hoisted(() => ({
  current: { user: { id: "test-editor", email: "editor@test.local", name: "Ed", role: "EDITOR" } },
}));

vi.mock("../lib/auth-context.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/auth-context.js")>()),
  getAuthContext: async () => authContext.current,
}));

const { buildServer } = await import("../server.js");
const { prisma } = await import("../lib/prisma.js");

const createdTierIds: number[] = [];

afterAll(async () => {
  await prisma.sponsorTier.deleteMany({ where: { id: { in: createdTierIds } } });
});

async function buildApp() {
  const app = await buildServer();
  await app.ready();
  return app;
}

async function seedTier() {
  const tier = await prisma.sponsorTier.create({
    data: { key: `zz-roles-${Date.now()}-${Math.round(performance.now())}`, nameFr: "Rôles", nameEn: "Roles" },
  });
  createdTierIds.push(tier.id);
  return tier;
}

describe("Sponsor tier writes are ADMIN-only (#521)", () => {
  it("should let an EDITOR read the catalogue the sponsor form needs", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/sponsor-tiers" });
    await app.close();

    expect(res.statusCode).toBe(200);
  });

  it("should refuse an EDITOR creating a tier", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/sponsor-tiers",
      payload: { key: `zz-roles-create-${Date.now()}`, nameFr: "X", nameEn: "X" },
    });
    await app.close();

    expect(res.statusCode).toBe(403);
  });

  it("should refuse an EDITOR updating or trashing a tier, and leave it untouched", async () => {
    const tier = await seedTier();
    const app = await buildApp();

    const update = await app.inject({
      method: "PUT",
      url: `/api/admin/sponsor-tiers/${tier.id}`,
      payload: { jobOfferQuota: 99 },
    });
    const remove = await app.inject({ method: "DELETE", url: `/api/admin/sponsor-tiers/${tier.id}` });
    await app.close();

    expect(update.statusCode).toBe(403);
    expect(remove.statusCode).toBe(403);
    const stored = await prisma.sponsorTier.findUnique({ where: { id: tier.id } });
    expect(stored?.jobOfferQuota).toBe(tier.jobOfferQuota);
    expect(stored?.deletedAt).toBeNull();
  });

  it("should let an ADMIN update a tier", async () => {
    const tier = await seedTier();
    const asEditor = authContext.current;
    authContext.current = { user: { id: "test-admin", email: "admin@test.local", name: "Ad", role: "ADMIN" } };

    try {
      const app = await buildApp();
      const res = await app.inject({
        method: "PUT",
        url: `/api/admin/sponsor-tiers/${tier.id}`,
        payload: { jobOfferQuota: 4 },
      });
      await app.close();

      expect(res.statusCode).toBe(200);
    } finally {
      authContext.current = asEditor;
    }
  });
});
