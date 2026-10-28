import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import adminAttendeeRoutes from "../routes/admin/attendees.js";
import adminBadgeRoutes from "../routes/admin/badges.js";
import { prisma } from "../lib/prisma.js";

// Badge numbering, freeze and the number written back to Billetweb (#639).
// This file owns the edition year 1643.
const YEAR = 1643;
const EVENT = "evt-1643";

type Row = Record<string, unknown>;
let billetwebAttendees: Row[] = [];
let rejectedIds = new Set<string>();
let writeCalls: Array<{ id: number; custom: Record<string, string> }[]> = [];

let editionId: number;
let tierId: number;
let outsideTierId: number;

beforeAll(async () => {
  vi.stubEnv("BILLETWEB_USER", "user");
  vi.stubEnv("BILLETWEB_KEY", "key");
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const path = String(url);
      let body: unknown = billetwebAttendees;
      if (path.includes("/forms")) {
        body = [{ ticket_fields: [{ id: "3", name: "Prénom" }, { id: "777", name: "Numéro de badge" }] }];
      } else if (path.includes("/update_product")) {
        const data = JSON.parse(String(init?.body)).data as Array<{ id: number; custom: Record<string, string> }>;
        writeCalls.push(data);
        body = Object.fromEntries(
          data.filter((d) => !rejectedIds.has(String(d.id))).map((d) => [String(d.id), { id: String(d.id) }]),
        );
      }
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }),
  );
  editionId = (await prisma.edition.create({ data: { year: YEAR, billetwebEventId: EVENT } })).id;
  tierId = (
    await prisma.ticketTier.create({
      data: { editionId, nameFr: "Normal", nameEn: "Normal", price: 90, sortOrder: 0, billetwebTicketId: "t1" },
    })
  ).id;
  outsideTierId = (
    await prisma.ticketTier.create({
      data: {
        editionId,
        nameFr: "Speaker",
        nameEn: "Speaker",
        price: 0,
        sortOrder: 1,
        billetwebTicketId: "t2",
        isOutsideFlow: true,
      },
    })
  ).id;
});

beforeEach(async () => {
  billetwebAttendees = [];
  rejectedIds = new Set();
  writeCalls = [];
  if (editionId !== undefined) {
    await prisma.attendee.deleteMany({ where: { editionId } });
    await prisma.edition.update({
      where: { id: editionId },
      data: {
        attendeesSyncedAt: null,
        badgesFrozenAt: null,
        badgeCounters: 4,
        badgeBinsPerCounter: 3,
        billetwebBadgeFieldId: null,
      },
    });
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

// Ticket n was bought n minutes after the first one, in its own order.
function attendee(n: number, overrides: Row = {}) {
  return {
    editionId,
    billetwebId: String(1000 + n),
    barcode: `code-${n}`,
    firstName: "Léa",
    lastName: `Martin ${n}`,
    billetwebTicketId: "t1",
    ticketTierId: tierId,
    orderId: String(5000 + n),
    orderDate: new Date(Date.UTC(2026, 8, 1, 8, n)),
    ...overrides,
  };
}

const seed = (count: number, overrides: Row = {}) =>
  prisma.attendee.createMany({ data: Array.from({ length: count }, (_, i) => attendee(i + 1, overrides)) });

async function call(method: "GET" | "POST" | "PUT", url: string, payload?: object) {
  const app = Fastify({ logger: false });
  await app.register(adminAttendeeRoutes, { prefix: "/api/admin" });
  await app.register(adminBadgeRoutes, { prefix: "/api/admin" });
  const res = await app.inject({ method, url, payload });
  await app.close();
  return res;
}
const status = () => call("GET", `/api/admin/badges/${editionId}`);
const freeze = () => call("POST", `/api/admin/badges/${editionId}/freeze`, { confirm: true });
const writeToBilletweb = () => call("POST", `/api/admin/badges/${editionId}/billetweb`);
// The write runs on after its 202: the report is read once it is over.
async function writeAndWait() {
  const res = await writeToBilletweb();
  await vi.waitFor(async () => expect((await status()).json().isWriting).toBe(false));
  return res;
}
// A refused freeze used to carry on after its 409 and freeze the edition a
// moment later: the reply was gone before the damage was done. Long enough
// for that tail to land, as measured when it did.
const settle = () => new Promise((resolve) => setTimeout(resolve, 500));
const numbers = async () =>
  (await prisma.attendee.findMany({ where: { editionId }, orderBy: { billetwebId: "asc" } })).map((a) => [
    a.billetwebId,
    a.badgeNumber,
  ]);

describe("Badge numbering and freeze (#639)", () => {
  it("should refuse to freeze one ticket over capacity, and number nothing", async () => {
    await prisma.edition.update({ where: { id: editionId }, data: { badgeCounters: 1, badgeBinsPerCounter: 1 } });
    await seed(101);

    const res = await freeze();
    await settle();

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: "capacity_exceeded" });
    expect(res.json().message).toContain("il manque 1 bacs");
    expect(await prisma.attendee.count({ where: { editionId, badgeNumber: { not: null } } })).toBe(0);
    expect((await prisma.edition.findUnique({ where: { id: editionId } }))?.badgesFrozenAt).toBeNull();
  });

  it("should freeze the numbering the preview showed, leaving out the dedicated flow and cancelled tickets", async () => {
    await seed(5);
    await prisma.attendee.createMany({
      data: [
        attendee(6, { ticketTierId: outsideTierId, billetwebTicketId: "t2" }),
        attendee(7, { isCancelled: true }),
      ],
    });
    const preview = (await status()).json();

    const res = await freeze();

    expect(res.statusCode).toBe(201);
    expect(await numbers()).toEqual([
      ["1001", 1000], ["1002", 2000], ["1003", 3000], ["1004", 4000], ["1005", 1100], ["1006", null], ["1007", null],
    ]);
    expect((await status()).json().bins).toEqual(preview.bins);
  });

  it("should refuse a second freeze and a layout change once frozen", async () => {
    await seed(2);
    await freeze();

    expect((await freeze()).statusCode).toBe(409);
    const settings = await call("PUT", `/api/admin/badges/${editionId}/settings`, {
      counters: 3,
      binsPerCounter: 3,
      billetwebBadgeFieldId: null,
    });
    expect(settings.statusCode).toBe(409);
  });

  it("should refuse to number while a ticket's tier is unknown", async () => {
    await seed(1);
    await prisma.attendee.create({ data: attendee(2, { ticketTierId: null, billetwebTicketId: "t9" }) });

    expect((await freeze()).json()).toMatchObject({ error: "tickets_without_tier" });
    await settle();
    expect((await prisma.edition.findUnique({ where: { id: editionId } }))?.badgesFrozenAt).toBeNull();
  });

  it("should leave a ticket imported after the freeze without a number, and renumber nothing", async () => {
    await seed(2);
    await freeze();
    const before = await numbers();
    billetwebAttendees = [
      {
        id: "999",
        barcode: "late",
        firstname: "Tom",
        name: "Retard",
        ticket_id: "t1",
        order_id: "1",
        order_date: "2026-08-01 10:00:00",
        disabled: "0",
      },
    ];

    await call("POST", `/api/admin/attendees/import/${editionId}`);

    expect(await numbers()).toEqual([...before, ["999", null]]);
    expect((await status()).json()).toMatchObject({ numbered: 2, withoutNumber: 1 });
  });

  it("should serve the print file as a PDF", async () => {
    await seed(3);

    const res = await call("GET", `/api/admin/badges/${editionId}/pdf`);

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("Badge numbers written to Billetweb (#639)", () => {
  it("should refuse before the freeze", async () => {
    await seed(1);

    expect((await writeToBilletweb()).json()).toMatchObject({ error: "badges_not_frozen" });
  });

  it("should write each number to the field found on the event's form", async () => {
    await seed(2);
    await freeze();

    const res = await writeAndWait();

    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ pending: 2, fieldId: "777" });
    expect((await status()).json()).toMatchObject({ written: 2, writeErrors: 0 });
    expect(writeCalls).toEqual([
      [
        { id: 1001, custom: { "777": "1000" } },
        { id: 1002, custom: { "777": "2000" } },
      ],
    ]);
  });

  it("should report a ticket Billetweb did not take, and retry it alone", async () => {
    await seed(3);
    await freeze();
    rejectedIds = new Set(["1002"]);

    await writeAndWait();
    expect((await status()).json()).toMatchObject({ written: 2, writeErrors: 1 });

    rejectedIds = new Set();
    writeCalls = [];
    expect((await writeAndWait()).json()).toMatchObject({ pending: 1 });
    expect((await status()).json()).toMatchObject({ written: 3, writeErrors: 0 });
    expect(writeCalls).toEqual([[{ id: 1002, custom: { "777": "2000" } }]]);
  });
});
