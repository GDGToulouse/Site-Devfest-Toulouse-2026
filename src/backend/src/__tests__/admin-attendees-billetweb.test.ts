import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import adminAttendeeRoutes from "../routes/admin/attendees.js";
import { prisma } from "../lib/prisma.js";

// Importing an edition's attendees from its linked Billetweb event (#638). This
// file owns the edition year 1642.
const YEAR = 1642;
const EVENT = "evt-1642";

type Row = Record<string, unknown>;
let attendees: Row[] = [];
let lastUrl = "";

function ticket(id: string, overrides: Row = {}): Row {
  return {
    id,
    barcode: `code-${id}`,
    firstname: "Léa",
    name: `Martin ${id}`,
    email: `${id}@example.com`,
    ticket_id: "t1",
    category: "",
    order_id: `o-${id}`,
    order_date: "2026-09-01 10:00:00",
    disabled: "0",
    custom: {},
    custom_order: {},
    ...overrides,
  };
}

let editionId: number;
let tierId: number;

beforeAll(async () => {
  vi.stubEnv("BILLETWEB_USER", "user");
  vi.stubEnv("BILLETWEB_KEY", "key");
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      lastUrl = String(url);
      return Promise.resolve(new Response(JSON.stringify(attendees), { status: 200 }));
    }),
  );
  editionId = (await prisma.edition.create({ data: { year: YEAR, billetwebEventId: EVENT } })).id;
  tierId = (
    await prisma.ticketTier.create({
      data: { editionId, nameFr: "Normal", nameEn: "Normal", price: 90, sortOrder: 0, billetwebTicketId: "t1" },
    })
  ).id;
});

beforeEach(async () => {
  attendees = [];
  if (editionId !== undefined) {
    await prisma.attendee.deleteMany({ where: { editionId } });
    await prisma.edition.update({ where: { id: editionId }, data: { attendeesSyncedAt: null } });
  }
});

afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  if (editionId !== undefined) {
    await prisma.attendee.deleteMany({ where: { editionId } });
    await prisma.ticketTier.deleteMany({ where: { editionId } });
    await prisma.edition.deleteMany({ where: { id: editionId } });
  }
});

async function call(method: "GET" | "POST", url: string) {
  const app = Fastify({ logger: false });
  await app.register(adminAttendeeRoutes, { prefix: "/api/admin" });
  const res = await app.inject({ method, url });
  await app.close();
  return res;
}
const importAttendees = () => call("POST", `/api/admin/attendees/import/${editionId}`);
const summary = () => call("GET", `/api/admin/attendees/summary/${editionId}`);

describe("Billetweb attendee import (#638)", () => {
  it("imports every ticket, refunded ones included, linked to its tier", async () => {
    attendees = [ticket("1"), ticket("2"), ticket("3", { disabled: "1" })];

    const res = await importAttendees();

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ isIncremental: false, created: 3, withoutTier: 0 });
    expect(lastUrl).toContain("disabled=1");
    expect(lastUrl).not.toContain("last_update");
    const rows = await prisma.attendee.findMany({ where: { editionId }, orderBy: { billetwebId: "asc" } });
    expect(rows.map((r) => [r.billetwebId, r.ticketTierId, r.isCancelled])).toEqual([
      ["1", tierId, false],
      ["2", tierId, false],
      ["3", tierId, true],
    ]);
  });

  it("changes nothing on a second import with nothing new, and asks only for what changed", async () => {
    attendees = [ticket("1"), ticket("2")];
    await importAttendees();
    const before = await prisma.attendee.findMany({ where: { editionId } });

    const res = await importAttendees();

    expect(res.json()).toMatchObject({ isIncremental: true, created: 0, updated: 0, unchanged: 2 });
    expect(lastUrl).toContain("last_update=");
    expect(await prisma.attendee.findMany({ where: { editionId } })).toEqual(before);
  });

  it("takes a refunded ticket out of the expected count, without deleting it", async () => {
    attendees = [ticket("1"), ticket("2")];
    await importAttendees();

    attendees = [ticket("2", { disabled: "1" })];
    const res = await importAttendees();

    expect(res.json()).toMatchObject({ cancelled: 1, updated: 1 });
    expect((await summary()).json()).toMatchObject({ expected: 1, cancelled: 1 });
    expect(await prisma.attendee.count({ where: { editionId } })).toBe(2);
  });

  it("refuses an edition with no linked event", async () => {
    await prisma.edition.update({ where: { id: editionId }, data: { billetwebEventId: null } });
    try {
      expect((await importAttendees()).statusCode).toBe(409);
    } finally {
      await prisma.edition.update({ where: { id: editionId }, data: { billetwebEventId: EVENT } });
    }
  });

  it("keeps the e-mail out of the summary", async () => {
    attendees = [ticket("1")];
    await importAttendees();

    const body = (await summary()).body;

    expect(body).not.toContain("@example.com");
    expect(JSON.parse(body).byTier).toEqual([
      { ticketTierId: tierId, name: "Normal", isOutsideFlow: false, expected: 1, cancelled: 0 },
    ]);
  });
});
