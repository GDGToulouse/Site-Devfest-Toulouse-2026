import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildAdminApp } from "./test-admin-app.js";
import { prisma } from "../lib/prisma.js";

// #822 — the edition's registration deadline, typed by hand in the ticketing
// tab, closes every tier once passed. This file owns its edition year.
const YEAR = 1822;
let editionId: number | undefined;
let tierId: number | undefined;

beforeAll(async () => {
  const edition = await prisma.edition.create({ data: { year: YEAR } });
  editionId = edition.id;
  const tier = await prisma.ticketTier.create({
    data: { nameFr: "Normal", nameEn: "Normal", price: 90, editionId, manualStatus: "AVAILABLE" },
  });
  tierId = tier.id;
});

afterAll(async () => {
  if (tierId !== undefined) await prisma.ticketTier.delete({ where: { id: tierId } });
  if (editionId !== undefined) await prisma.edition.delete({ where: { id: editionId } });
});

async function putSalesEnd(salesEndAt: string | null) {
  const app = await buildAdminApp();
  const res = await app.inject({
    method: "PUT",
    url: "/api/admin/tickets/sales-end",
    payload: { editionId, salesEndAt },
  });
  await app.close();
  return res;
}

async function tierStatus() {
  const app = await buildAdminApp();
  const res = await app.inject({ method: "GET", url: `/api/admin/tickets?editionId=${editionId}` });
  await app.close();
  return res.json()[0].status;
}

describe("PUT /api/admin/tickets/sales-end", () => {
  it("should store the deadline and read it back", async () => {
    const res = await putSalesEnd("2026-11-16T22:55:00.000Z");
    expect(res.statusCode).toBe(200);

    const stored = await prisma.edition.findUnique({ where: { id: editionId } });
    expect(stored?.ticketSalesEndAt?.toISOString()).toBe("2026-11-16T22:55:00.000Z");

    const app = await buildAdminApp();
    const read = await app.inject({ method: "GET", url: `/api/admin/tickets/sales-end?editionId=${editionId}` });
    await app.close();
    expect(read.json()).toEqual({ salesEndAt: "2026-11-16T22:55:00.000Z" });
  });

  it("should close a tier forced available once the deadline has passed", async () => {
    await putSalesEnd("2020-01-01T00:00:00.000Z");
    expect(await tierStatus()).toBe("CLOSED");
  });

  it("should give the tier its own status back when the deadline is cleared", async () => {
    await putSalesEnd(null);
    const stored = await prisma.edition.findUnique({ where: { id: editionId } });
    expect(stored?.ticketSalesEndAt).toBeNull();
    expect(await tierStatus()).toBe("AVAILABLE");
  });

  it("should reject an unreadable date", async () => {
    const res = await putSalesEnd("lundi soir");
    expect(res.statusCode).toBe(400);
  });

  it("should answer 404 for an unknown edition", async () => {
    const app = await buildAdminApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/admin/tickets/sales-end",
      payload: { editionId: 999999999, salesEndAt: null },
    });
    await app.close();
    expect(res.statusCode).toBe(404);
  });
});
