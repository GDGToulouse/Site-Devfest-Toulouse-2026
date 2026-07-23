import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildAdminApp } from "./test-admin-app.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { tierIdByKey } from "./sponsor-test-helpers.js";

// #318 — per-edition tier bindings (visibility, price, order). Mutations run on
// an ad-hoc edition so they never disturb the seeded links that other parallel
// files read. Read-only assertions use the seeded edition.
let testEditionId: number;

beforeAll(async () => {
  // A year well below the seeded range so getSeededEdition never picks it (#292).
  const edition = await prisma.edition.create({ data: { year: 1990 } });
  testEditionId = edition.id;
});

afterAll(async () => {
  await prisma.editionSponsorTier.deleteMany({ where: { editionId: testEditionId } });
  await prisma.edition.delete({ where: { id: testEditionId } });
});

describe("Admin Edition Sponsor Tiers API (#318)", () => {
  it("lists the seeded edition's bindings joined to the tier, sorted by sortOrder", async () => {
    const edition = await getSeededEdition();
    const app = await buildAdminApp();
    const res = await app.inject({ method: "GET", url: `/api/admin/editions/${edition.id}/sponsor-tiers` });
    await app.close();

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.length).toBeGreaterThanOrEqual(4);
    // Joined tier is present, sortOrder is ascending.
    expect(body[0].tier).toBeDefined();
    expect(body[0].tier.nameFr).toBeDefined();
    const orders = body.map((l: { sortOrder: number }) => l.sortOrder);
    expect([...orders]).toEqual([...orders].sort((a, b) => a - b));
  });

  it("upserts a binding: creates then applies isVisible/price/sortOrder", async () => {
    const tierId = await tierIdByKey("platinum");

    const app = await buildAdminApp();
    const create = await app.inject({
      method: "PUT",
      url: `/api/admin/editions/${testEditionId}/sponsor-tiers/${tierId}`,
      payload: { isVisible: false, price: "5000 EUR", sortOrder: 3 },
    });
    await app.close();
    expect(create.statusCode).toBe(200);

    const stored = await prisma.editionSponsorTier.findUnique({
      where: { editionId_tierId: { editionId: testEditionId, tierId } },
    });
    expect(stored?.isVisible).toBe(false);
    expect(stored?.price).toBe("5000 EUR");
    expect(stored?.sortOrder).toBe(3);

    // A second PUT updates the same row rather than duplicating it.
    const upd = await buildAdminApp();
    const update = await upd.inject({
      method: "PUT",
      url: `/api/admin/editions/${testEditionId}/sponsor-tiers/${tierId}`,
      payload: { isVisible: true },
    });
    await upd.close();
    expect(update.statusCode).toBe(200);
    const after = await prisma.editionSponsorTier.findUnique({
      where: { editionId_tierId: { editionId: testEditionId, tierId } },
    });
    expect(after?.isVisible).toBe(true);
    expect(after?.price).toBe("5000 EUR"); // untouched by the partial update
  });

  it("rejects a binding to a non-existent tier with 422", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/editions/${testEditionId}/sponsor-tiers/999999`,
      payload: { isVisible: true },
    });
    await app.close();
    expect(res.statusCode).toBe(422);
  });

  it("removes a binding and is idempotent", async () => {
    const tierId = await tierIdByKey("gold");
    // Ensure it exists first.
    const setup = await buildAdminApp();
    await setup.inject({
      method: "PUT",
      url: `/api/admin/editions/${testEditionId}/sponsor-tiers/${tierId}`,
      payload: { isVisible: true },
    });
    await setup.close();

    const app = await buildAdminApp();
    const del = await app.inject({ method: "DELETE", url: `/api/admin/editions/${testEditionId}/sponsor-tiers/${tierId}` });
    await app.close();
    expect(del.statusCode).toBe(204);

    const count = await prisma.editionSponsorTier.count({ where: { editionId: testEditionId, tierId } });
    expect(count).toBe(0);

    // Deleting again is a no-op, still 204.
    const again = await buildAdminApp();
    const del2 = await again.inject({ method: "DELETE", url: `/api/admin/editions/${testEditionId}/sponsor-tiers/${tierId}` });
    await again.close();
    expect(del2.statusCode).toBe(204);
  });
});
