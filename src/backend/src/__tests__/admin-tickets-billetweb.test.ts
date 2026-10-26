import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { buildAdminApp } from "./test-admin-app.js";
import { prisma } from "../lib/prisma.js";

// Re-importing an edition's tiers from its linked Billetweb event (#637). This
// file owns the edition years 1640-1641.
const YEAR = 1640;
const OTHER_YEAR = 1641;
const EVENT = "evt-1640";

type Ticket = { id: string; name: string; price: string };
let tickets: Ticket[] = [];

// Billetweb answers from `tickets`; any other URL (cache purge…) gets an empty 200.
function fakeBilletweb(url: string) {
  const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  if (url.includes("/events?")) return json([{ id: EVENT, name: "DevFest 1640", shop: "https://shop/1640" }]);
  if (url.includes(`/event/${EVENT}/tickets`)) return json(tickets.map((t) => ({ ...t, visibility: "0" })));
  return json([]);
}

let editionId: number;
let otherEditionId: number;

beforeAll(async () => {
  vi.stubEnv("BILLETWEB_USER", "user");
  vi.stubEnv("BILLETWEB_KEY", "key");
  vi.stubGlobal("fetch", vi.fn((url: string) => fakeBilletweb(String(url))));
  editionId = (await prisma.edition.create({ data: { year: YEAR } })).id;
  otherEditionId = (await prisma.edition.create({ data: { year: OTHER_YEAR } })).id;
});

beforeEach(async () => {
  tickets = [];
  if (editionId !== undefined) {
    await prisma.ticketTier.deleteMany({ where: { editionId: { in: [editionId, otherEditionId] } } });
    await prisma.edition.updateMany({
      where: { id: { in: [editionId, otherEditionId] } },
      data: { billetwebEventId: null, billetwebEventName: null },
    });
  }
});

afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  if (editionId !== undefined) {
    await prisma.ticketTier.deleteMany({ where: { editionId: { in: [editionId, otherEditionId] } } });
    await prisma.edition.deleteMany({ where: { id: { in: [editionId, otherEditionId] } } });
  }
});

async function importTiers(payload: Record<string, unknown>) {
  const app = await buildAdminApp();
  const res = await app.inject({ method: "POST", url: "/api/admin/tickets/import/billetweb", payload });
  await app.close();
  return res;
}

function tiersOf(id: number) {
  return prisma.ticketTier.findMany({ where: { editionId: id }, orderBy: { sortOrder: "asc" } });
}

describe("Billetweb tier import (#637)", () => {
  it("links the edition to the event on the first import", async () => {
    tickets = [{ id: "t1", name: "Early", price: "40" }];
    const res = await importTiers({ editionId, billetwebEventId: EVENT });
    expect(res.statusCode).toBe(201);

    const edition = await prisma.edition.findUnique({ where: { id: editionId } });
    expect(edition).toMatchObject({ billetwebEventId: EVENT, billetwebEventName: "DevFest 1640" });
  });

  it("keeps tier ids and the outside-the-flow box across a re-import that reorders", async () => {
    tickets = [
      { id: "t1", name: "Early", price: "40" },
      { id: "t2", name: "Speakers", price: "0" },
    ];
    await importTiers({ editionId, billetwebEventId: EVENT });
    const [early, speakers] = await tiersOf(editionId);
    await prisma.ticketTier.update({ where: { id: speakers.id }, data: { isOutsideFlow: true } });

    tickets = [
      { id: "t2", name: "Speakers", price: "0" },
      { id: "t1", name: "Early", price: "45" },
    ];
    const res = await importTiers({ editionId });
    expect(res.statusCode).toBe(201);

    const after = await tiersOf(editionId);
    expect(after.map((t) => [t.id, t.sortOrder, t.isOutsideFlow, Number(t.price)])).toEqual([
      [speakers.id, 0, true, 0],
      [early.id, 1, false, 45],
    ]);
  });

  it("trashes a tier Billetweb dropped and keeps one created by hand", async () => {
    tickets = [{ id: "t1", name: "Early", price: "40" }];
    await importTiers({ editionId, billetwebEventId: EVENT });
    const manual = await prisma.ticketTier.create({
      data: { editionId, nameFr: "Invitation", nameEn: "Invitation", price: 0, sortOrder: 5 },
    });

    tickets = [{ id: "t3", name: "Late", price: "60" }];
    await importTiers({ editionId });

    const after = await tiersOf(editionId);
    const live = after.filter((t) => t.deletedAt === null);
    expect(live.map((t) => [t.id === manual.id, t.nameFr])).toEqual([
      [false, "Late"],
      [true, "Invitation"],
    ]);
    expect(after.find((t) => t.nameFr === "Early")?.deletedAt).not.toBeNull();
  });

  it("attaches tiers imported before ids were kept, by name", async () => {
    const legacy = await prisma.ticketTier.create({
      data: { editionId, nameFr: "Early", nameEn: "Early", price: 40, sortOrder: 0 },
    });
    tickets = [{ id: "t1", name: "Early", price: "40" }];
    await importTiers({ editionId, billetwebEventId: EVENT });

    const after = await tiersOf(editionId);
    expect(after.map((t) => [t.id, t.billetwebTicketId])).toEqual([[legacy.id, "t1"]]);
  });

  it("refuses another event while the edition is linked", async () => {
    tickets = [{ id: "t1", name: "Early", price: "40" }];
    await importTiers({ editionId, billetwebEventId: EVENT });

    const res = await importTiers({ editionId, billetwebEventId: "another-event" });
    expect(res.statusCode).toBe(409);
  });

  it("unlinks without touching the tiers, and relinking finds them again", async () => {
    tickets = [{ id: "t1", name: "Early", price: "40" }];
    await importTiers({ editionId: otherEditionId, billetwebEventId: EVENT });
    const [before] = await tiersOf(otherEditionId);

    const app = await buildAdminApp();
    const unlink = await app.inject({ method: "DELETE", url: `/api/admin/tickets/billetweb/link/${otherEditionId}` });
    const link = await app.inject({ method: "GET", url: `/api/admin/tickets/billetweb/link/${otherEditionId}` });
    await app.close();
    expect(unlink.statusCode).toBe(200);
    expect(link.json()).toEqual({ billetwebEventId: null, billetwebEventName: null });
    expect(await tiersOf(otherEditionId)).toHaveLength(1);

    await importTiers({ editionId: otherEditionId, billetwebEventId: EVENT });
    const after = await tiersOf(otherEditionId);
    expect(after.map((t) => [t.id, t.deletedAt])).toEqual([[before.id, null]]);
  });
});
