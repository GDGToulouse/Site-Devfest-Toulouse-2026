import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import { PDFDocument } from "pdf-lib";
import adminAttendeeRoutes from "../routes/admin/attendees.js";
import adminBadgeRoutes from "../routes/admin/badges.js";
import { prisma } from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

// Badge numbering, freeze and the number written back to Billetweb (#639), and
// the two ways back (#774). This file owns the edition year 1643.
const authContext = vi.hoisted(() => ({
  current: { user: { id: "test-admin", email: "admin@test.local", name: "Ad", role: "ADMIN" } },
}));

vi.mock("../lib/auth-context.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/auth-context.js")>()),
  getAuthContext: async () => authContext.current,
}));

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
  authContext.current.user.role = "ADMIN";
  billetwebAttendees = [];
  rejectedIds = new Set();
  writeCalls = [];
  if (editionId !== undefined) {
    await prisma.attendee.deleteMany({ where: { editionId } });
    await prisma.edition.update({
      where: { id: editionId },
      data: {
        attendeesSyncedAt: null,
        attendeesPurgedAt: null,
        badgesFrozenAt: null,
        badgeCounters: 4,
        badgeBinsPerCounter: 3,
        badgesPerBin: 99,
        badgeDesign: Prisma.DbNull,
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
    await seed(100);

    const res = await freeze();
    await settle();

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: "capacity_exceeded" });
    expect(res.json().message).toContain("il manque 1 présentoir.");
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
      ["1001", 1100], ["1002", 2100], ["1003", 3100], ["1004", 4100], ["1005", 1200], ["1006", null], ["1007", null],
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
      badgesPerBin: 99,
      billetwebBadgeFieldId: null,
    });
    expect(settings.statusCode).toBe(409);
  });

  it("should change the bin size after the freeze only on an explicit confirmation", async () => {
    await seed(2);
    await freeze();
    const resize = (confirm?: boolean) =>
      call("PUT", `/api/admin/badges/${editionId}/settings`, {
        counters: 4,
        binsPerCounter: 3,
        badgesPerBin: 50,
        billetwebBadgeFieldId: null,
        ...(confirm === undefined ? {} : { confirm }),
      });

    const unconfirmed = await resize();
    const confirmed = await resize(true);

    expect([unconfirmed.statusCode, unconfirmed.json().error]).toEqual([409, "confirm_required"]);
    expect(confirmed.statusCode).toBe(200);
    expect((await status()).json()).toMatchObject({ badgesPerBin: 50, capacity: 600 });
  });

  it("should refuse to number beyond bins smaller than 100", async () => {
    await prisma.edition.update({ where: { id: editionId }, data: { badgeCounters: 1, badgeBinsPerCounter: 1, badgesPerBin: 50 } });
    await seed(51);

    const res = await freeze();
    await settle();

    expect(res.json()).toMatchObject({ error: "capacity_exceeded" });
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

describe("Badge design and preview (#639, #749)", () => {
  const pageCount = async (bytes: Buffer) => (await PDFDocument.load(bytes)).getPageCount();
  const design = (overrides: Record<string, unknown> = {}) => ({
    qrContent: "VCARD",
    qrColor: "#5F3B9F",
    types: Object.fromEntries(
      ["PARTICIPANT", "SPONSOR", "STAFF", "SPEAKER", "VOLUNTEER", "CONTRACTOR"].map((t) => [
        t,
        { background: null, backBackground: null, color: "#FFFFFF" },
      ]),
    ),
    ...overrides,
  });

  it("should preview the front and back of each of the six types, numbering untouched", async () => {
    await seed(2);

    const res = await call("GET", `/api/admin/badges/${editionId}/preview`);

    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(await pageCount(res.rawPayload)).toBe(12);
    expect(JSON.parse(decodeURIComponent(res.headers["x-badge-pages"] as string))).toEqual([
      { type: "PARTICIPANT", name: "Participant", isNumbered: true },
      { type: "SPONSOR", name: "Sponsor", isNumbered: true },
      { type: "STAFF", name: "Staff", isNumbered: false },
      { type: "SPEAKER", name: "Speaker", isNumbered: false },
      { type: "VOLUNTEER", name: "Bénévole", isNumbered: false },
      { type: "CONTRACTOR", name: "Prestataire", isNumbered: false },
    ]);
    expect(await prisma.attendee.count({ where: { editionId, badgeNumber: { not: null } } })).toBe(0);
  });

  it("should store the design and each tier's badge", async () => {
    const res = await call("PUT", `/api/admin/badges/${editionId}/design`, {
      design: design(),
      tierTypes: [{ tierId: outsideTierId, badgeType: "VOLUNTEER" }],
    });

    expect(res.statusCode).toBe(200);
    expect((await status()).json()).toMatchObject({
      design: { qrContent: "VCARD" },
      tiers: expect.arrayContaining([{ id: outsideTierId, name: expect.any(String), isOutsideFlow: true, badgeType: "VOLUNTEER", isGuessed: false }]),
    });
  });

  it("should refuse a badge type the tier's flow does not allow", async () => {
    const outsideWithParticipant = await call("PUT", `/api/admin/badges/${editionId}/design`, {
      design: design(),
      tierTypes: [{ tierId: outsideTierId, badgeType: "PARTICIPANT" }],
    });
    const counterWithSpeaker = await call("PUT", `/api/admin/badges/${editionId}/design`, {
      design: design(),
      tierTypes: [{ tierId, badgeType: "SPEAKER" }],
    });
    const counterWithSponsor = await call("PUT", `/api/admin/badges/${editionId}/design`, {
      design: design(),
      tierTypes: [{ tierId, badgeType: "SPONSOR" }],
    });

    expect([outsideWithParticipant.statusCode, outsideWithParticipant.json().error]).toEqual([400, "invalid_tier_badge_type"]);
    expect(counterWithSpeaker.statusCode).toBe(400);
    expect(counterWithSponsor.statusCode).toBe(200);
  });

  it("should refuse a background that is not a file of the media library", async () => {
    const res = await call("PUT", `/api/admin/badges/${editionId}/design`, {
      design: design({
        types: {
          ...design().types,
          SPEAKER: { background: "https://example.org/fond.png", backBackground: null, color: "#FFFFFF" },
        },
      }),
      tierTypes: [],
    });

    expect([res.statusCode, res.json().error]).toEqual([400, "invalid_design"]);
  });

  it("should print the dedicated flow's badges after the participants, without a number", async () => {
    await seed(2);
    await prisma.attendee.create({ data: attendee(3, { ticketTierId: outsideTierId, billetwebTicketId: "t2" }) });

    const res = await call("GET", `/api/admin/badges/${editionId}/pdf`);

    // Recto-verso: two bins with a separator and a badge each, then the speakers' separator and badge, each followed by a back.
    expect(await pageCount(res.rawPayload)).toBe(12);
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
        { id: 1001, custom: { "777": "1100" } },
        { id: 1002, custom: { "777": "2100" } },
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
    expect(writeCalls).toEqual([[{ id: 1002, custom: { "777": "2100" } }]]);
  });
});

describe("Taking the freeze back (#774)", () => {
  const unfreeze = (confirm = "ANNULER") => call("POST", `/api/admin/badges/${editionId}/unfreeze`, { confirm });
  const waitIdle = () => vi.waitFor(async () => expect((await status()).json().isWriting).toBe(false));
  const frozenAt = async () => (await prisma.edition.findUnique({ where: { id: editionId } }))?.badgesFrozenAt;

  it("should erase the numbers and the freeze date, blank the Billetweb field, and allow a new freeze", async () => {
    await seed(3);
    await freeze();
    await writeAndWait();
    writeCalls = [];

    const res = await unfreeze();
    await waitIdle();

    expect(res.json()).toEqual({ unfrozen: true, blanking: 3 });
    expect(await frozenAt()).toBeNull();
    expect((await numbers()).map(([, n]) => n)).toEqual([null, null, null]);
    expect(writeCalls.flat().map((d) => d.custom["777"])).toEqual(["", "", ""]);
    expect((await freeze()).statusCode).toBe(201);
  });

  it("should refuse once a badge has been scanned, and keep the numbers", async () => {
    await seed(2);
    await freeze();
    await prisma.attendee.updateMany({ where: { editionId, billetwebId: "1001" }, data: { scannedAt: new Date() } });

    const res = await unfreeze();

    expect([res.statusCode, res.json().error]).toEqual([409, "badges_scanned"]);
    expect(await frozenAt()).not.toBeNull();
    expect((await numbers()).map(([, n]) => n)).toEqual([1100, 2100]);
  });

  it("should refuse a badge that moved without a scan, and an edition that is not frozen", async () => {
    await seed(1);
    expect((await unfreeze()).json().error).toBe("badges_not_frozen");
    await freeze();
    await prisma.attendee.updateMany({ where: { editionId }, data: { badgeState: "READY" } });

    expect((await unfreeze()).json().error).toBe("badges_scanned");
  });

  it("should be for admins only, and need the typed word", async () => {
    await seed(1);
    await freeze();

    authContext.current.user.role = "EDITOR";
    const asEditor = await unfreeze();
    authContext.current.user.role = "ADMIN";
    const wrongWord = await unfreeze("oui");

    expect(asEditor.statusCode).toBe(403);
    expect(wrongWord.statusCode).toBe(400);
    expect(await frozenAt()).not.toBeNull();
  });
});

describe("Resetting the arrivals (#774)", () => {
  const reset = (confirm = "REINITIALISER") => call("POST", `/api/admin/badges/${editionId}/reset`, { confirm });

  it("should delete the attendees with their history, and the freeze, without marking the edition purged", async () => {
    await seed(2);
    await freeze();
    const [first] = await prisma.attendee.findMany({ where: { editionId } });
    await prisma.badgeTransition.create({
      data: { attendeeId: first.id, fromState: "PRINTED", toState: "TO_FETCH", userLabel: "test" },
    });
    await prisma.attendee.update({ where: { id: first.id }, data: { scannedAt: new Date() } });
    await prisma.edition.update({ where: { id: editionId }, data: { attendeesSyncedAt: new Date() } });

    const res = await reset();

    const edition = await prisma.edition.findUnique({ where: { id: editionId } });
    expect(res.json()).toEqual({ deleted: 2 });
    expect(await prisma.attendee.count({ where: { editionId } })).toBe(0);
    expect(await prisma.badgeTransition.count({ where: { attendeeId: first.id } })).toBe(0);
    expect([edition?.badgesFrozenAt, edition?.attendeesSyncedAt, edition?.attendeesPurgedAt]).toEqual([null, null, null]);
  });

  it("should be refused in production, leaving everything in place", async () => {
    await seed(2);
    vi.stubEnv("ENV_NAME", "prod");

    const res = await reset();
    vi.stubEnv("ENV_NAME", "");

    expect([res.statusCode, res.json().error]).toEqual([403, "reset_forbidden_in_production"]);
    expect(await prisma.attendee.count({ where: { editionId } })).toBe(2);
    expect((await status()).json().isResetAllowed).toBe(true);
  });

  it("should be refused for the production address even without an environment name", async () => {
    await seed(1);
    const originalBaseUrl = process.env.BASE_URL ?? "";
    vi.stubEnv("ENV_NAME", "");
    vi.stubEnv("BASE_URL", "https://devfesttoulouse.fr");

    const res = await reset();
    const allowed = (await status()).json().isResetAllowed;
    vi.stubEnv("BASE_URL", originalBaseUrl);

    expect(res.statusCode).toBe(403);
    expect(allowed).toBe(false);
    expect(await prisma.attendee.count({ where: { editionId } })).toBe(1);
  });

  it("should be for admins only, and need the typed word", async () => {
    await seed(1);

    authContext.current.user.role = "EDITOR";
    const asEditor = await reset();
    authContext.current.user.role = "ADMIN";
    const wrongWord = await reset("oui");

    expect(asEditor.statusCode).toBe(403);
    expect(wrongWord.statusCode).toBe(400);
    expect(await prisma.attendee.count({ where: { editionId } })).toBe(1);
  });
});
