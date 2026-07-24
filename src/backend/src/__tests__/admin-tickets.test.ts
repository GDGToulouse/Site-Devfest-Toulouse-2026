import { describe, it, expect, afterEach } from "vitest";
import { buildAdminApp } from "./test-admin-app.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// Teardown is scoped to the rows THIS file created, tracked by id. The old
// version ran `deleteMany({ deletedAt: { not: null } })`, which wiped every
// trashed tier in the shared database — including ones a parallel file had just
// soft-deleted and was about to read (same interference class as #292).
const createdTierIds: number[] = [];

afterEach(async () => {
  if (createdTierIds.length) {
    await prisma.ticketTier.deleteMany({ where: { id: { in: createdTierIds } } });
    createdTierIds.length = 0;
  }
});

async function createTier(editionId: number, overrides: Record<string, unknown> = {}) {
  const app = await buildAdminApp();
  const res = await app.inject({
    method: "POST",
    url: "/api/admin/tickets",
    payload: { nameFr: "Test Billet", nameEn: "Test Ticket", price: 42, editionId, ...overrides },
  });
  await app.close();
  if (res.statusCode === 201) createdTierIds.push(res.json().id);
  return res;
}

describe("Admin Tickets API", () => {
  it("lists ticket tiers", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/tickets" });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
    await app.close();
  });

  it("creates a tier and reads it back with the given values", async () => {
    const edition = await getSeededEdition();
    const create = await createTier(edition.id, { nameFr: "Early Bird", price: 30 });
    expect(create.statusCode).toBe(201);
    const { id } = create.json();

    // Assert against the stored row, not just the 201 — the old test never
    // checked the values actually landed.
    const stored = await prisma.ticketTier.findUnique({ where: { id } });
    expect(stored?.nameFr).toBe("Early Bird");
    expect(Number(stored?.price)).toBe(30);
    expect(stored?.editionId).toBe(edition.id);
  });

  it("applies a PUT to the stored row", async () => {
    const edition = await getSeededEdition();
    const { id } = (await createTier(edition.id)).json();

    const app = await buildAdminApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/tickets/${id}`,
      payload: { nameFr: "Tarif modifié", price: 55, manualStatus: "SOLD_OUT" },
    });
    await app.close();
    expect(res.statusCode).toBe(200);

    // The point the old test missed: prove the update persisted.
    const stored = await prisma.ticketTier.findUnique({ where: { id } });
    expect(stored?.nameFr).toBe("Tarif modifié");
    expect(Number(stored?.price)).toBe(55);
    expect(stored?.manualStatus).toBe("SOLD_OUT");
  });

  it("soft-deletes on DELETE, keeping the row with deletedAt set (#147)", async () => {
    const edition = await getSeededEdition();
    const { id } = (await createTier(edition.id)).json();

    const app = await buildAdminApp();
    const del = await app.inject({ method: "DELETE", url: `/api/admin/tickets/${id}` });
    await app.close();
    expect(del.statusCode).toBe(200);

    // A soft delete keeps the row — a hard delete or a no-op would both have
    // passed the old "status 200" assertion. This distinguishes them.
    const stored = await prisma.ticketTier.findUnique({ where: { id } });
    expect(stored).not.toBeNull();
    expect(stored?.deletedAt).toBeInstanceOf(Date);
  });

  it("appends distinct sortOrder when none is supplied (#61771b5)", async () => {
    // Two tiers created without sortOrder on the same edition must not collide
    // on @@unique([editionId, sortOrder]) — the exact bug the auto-append fix
    // prevents, previously untested.
    const edition = await getSeededEdition();

    const first = await createTier(edition.id, { nameFr: "Tier A" });
    const second = await createTier(edition.id, { nameFr: "Tier B" });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);

    const a = await prisma.ticketTier.findUnique({ where: { id: first.json().id } });
    const b = await prisma.ticketTier.findUnique({ where: { id: second.json().id } });
    expect(a?.sortOrder).not.toBe(b?.sortOrder);
    // The second lands strictly after the first.
    expect(b!.sortOrder).toBeGreaterThan(a!.sortOrder);
  });

  it("rejects a create missing required fields", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/tickets",
      payload: { nameFr: "", nameEn: "" },
    });
    await app.close();
    expect(res.statusCode).toBe(400);
  });
});
