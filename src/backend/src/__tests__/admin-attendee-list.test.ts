import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import adminAttendeeRoutes from "../routes/admin/attendees.js";
import { prisma } from "../lib/prisma.js";

// The admin's list of attendees and where their arrival stands (#806). This
// file owns the edition year 1650.
const YEAR = 1650;

let editionId: number;
let seq = 0;

async function attendee(data: Record<string, unknown>) {
  seq += 1;
  return prisma.attendee.create({
    data: {
      editionId,
      billetwebId: `l-${seq}`,
      barcode: `bar-l-${seq}`,
      firstName: "Léa",
      lastName: `Liste${seq}`,
      email: `l${seq}@example.com`,
      billetwebTicketId: "t1",
      orderId: `o-l-${seq}`,
      orderDate: new Date("2026-09-01T10:00:00Z"),
      ...data,
    },
  });
}

beforeAll(async () => {
  editionId = (await prisma.edition.create({ data: { year: YEAR } })).id;
  const at = new Date("2026-11-20T08:30:00Z");
  await attendee({ firstName: "Hélène", lastName: "Arrivée", company: "Cassoulet SA", badgeNumber: 1205 });
  await attendee({ firstName: "Bruno", lastName: "Confirme", badgeNumber: 1206, scannedAt: at, scannedByLabel: "Poste Scan", checkedInAt: at, badgeState: "TO_FETCH" });
  await attendee({ firstName: "Chloé", lastName: "Enattente", badgeNumber: 1207, scannedAt: at, badgeState: "READY" });
  await attendee({ firstName: "Denis", lastName: "Echec", scannedAt: at, checkInError: "HTTP 500" });
  await attendee({ firstName: "Emma", lastName: "Externe", scannedAt: at, scannedByLabel: "Billetweb Scan (Entrée)", checkedInAt: at });
  await attendee({ firstName: "Félix", lastName: "Remis", badgeNumber: 2101, scannedAt: at, checkedInAt: at, badgeState: "DELIVERED" });
  await attendee({ firstName: "Gaël", lastName: "Annule", isCancelled: true, badgeNumber: 2102 });
  await attendee({ firstName: "Hugo", lastName: "Decomposte", checkedInAt: at });
  const dedicated = await prisma.ticketTier.create({
    data: { editionId, nameFr: "Speaker", nameEn: "Speaker", price: 0, sortOrder: 1, billetwebTicketId: "t2", isOutsideFlow: true },
  });
  await attendee({ firstName: "Inès", lastName: "Speaker", ticketTierId: dedicated.id, scannedAt: at, checkedInAt: at });
});

afterAll(async () => {
  if (editionId !== undefined) {
    await prisma.attendee.deleteMany({ where: { editionId } });
    await prisma.ticketTier.deleteMany({ where: { editionId } });
    await prisma.edition.deleteMany({ where: { id: editionId } });
  }
});

async function list(query = "") {
  const app = Fastify({ logger: false });
  await app.register(adminAttendeeRoutes, { prefix: "/api/admin" });
  const res = await app.inject({ method: "GET", url: `/api/admin/attendees/list/${editionId}${query}` });
  await app.close();
  return res;
}

const names = (body: { items: Array<{ lastName: string }> }) => body.items.map((i) => i.lastName);

describe("GET /api/admin/attendees/list/:editionId (#806)", () => {
  it("should list every attendee by last name, with the total", async () => {
    const body = (await list()).json();

    expect(body.total).toBe(9);
    expect(names(body)).toEqual(["Annule", "Arrivée", "Confirme", "Decomposte", "Echec", "Enattente", "Externe", "Remis", "Speaker"]);
  });

  it("should say where each ticket stands on Billetweb", async () => {
    const byName = Object.fromEntries((await list()).json().items.map((i: { lastName: string; billetweb: string }) => [i.lastName, i.billetweb]));

    expect(byName).toMatchObject({
      Arrivée: "none",
      Confirme: "confirmed",
      Enattente: "pending",
      Echec: "error",
      Externe: "external",
      Decomposte: "undo_pending",
    });
  });

  it("should never send the e-mail", async () => {
    expect((await list()).body).not.toContain("@example.com");
  });

  it("should find a person without their accents, or by company", async () => {
    expect(names((await list("?search=helene")).json())).toEqual(["Arrivée"]);
    expect(names((await list("?search=cassou")).json())).toEqual(["Arrivée"]);
  });

  it("should find a badge number typed with or without its spaces", async () => {
    expect(names((await list("?search=1205")).json())).toEqual(["Arrivée"]);
    expect(names((await list(`?search=${encodeURIComponent("1 2 05")}`)).json())).toEqual(["Arrivée"]);
  });

  it("should filter the check-ins Billetweb has not acknowledged", async () => {
    expect(names((await list("?filter=checkin_issue")).json())).toEqual(["Decomposte", "Echec", "Enattente"]);
  });

  it("should filter by where the arrival stands", async () => {
    expect(names((await list("?filter=not_scanned")).json())).toEqual(["Arrivée", "Decomposte"]);
    // Never the dedicated flow: no badge to hand over at a counter.
    expect(names((await list("?filter=waiting")).json())).toEqual(["Confirme", "Echec", "Enattente", "Externe"]);
    expect(names((await list("?filter=delivered")).json())).toEqual(["Remis"]);
    expect(names((await list("?filter=cancelled")).json())).toEqual(["Annule"]);
  });

  it("should return one page at a time", async () => {
    const body = (await list("?page=2&limit=3")).json();

    expect(body).toMatchObject({ page: 2, limit: 3, total: 9 });
    expect(names(body)).toEqual(["Decomposte", "Echec", "Enattente"]);
  });

  it("should refuse an unknown filter", async () => {
    expect((await list("?filter=everyone")).statusCode).toBe(400);
  });

  it("should answer 404 for an unknown edition", async () => {
    const app = Fastify({ logger: false });
    await app.register(adminAttendeeRoutes, { prefix: "/api/admin" });
    const res = await app.inject({ method: "GET", url: "/api/admin/attendees/list/999999999" });
    await app.close();
    expect(res.statusCode).toBe(404);
  });
});
