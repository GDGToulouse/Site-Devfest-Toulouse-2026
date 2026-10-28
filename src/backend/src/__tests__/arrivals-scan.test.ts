process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { createHash } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import arrivalsRoutes from "../routes/arrivals.js";
import { checkInPending, isCheckInRunning } from "../lib/billetweb-checkin.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";
import { prisma } from "../lib/prisma.js";

// The entrance (#642): scan, name search, Billetweb check-in, degraded-mode
// table. Billetweb is a stub here: no test ever reaches the real API. This file
// owns the edition year 1647.
const YEAR = 1647;

let app: FastifyInstance;
let editionId: number;
let inFlowTierId: number;
let dedicatedTierId: number;
let headers: Record<string, string>;
let volunteerName: string;
const userIds: string[] = [];
let stamp = 0;

// What Billetweb was sent, and what it answers.
const checkInCalls: Array<{ url: string; data: Array<{ id: number; used: number; lane: string }> }> = [];
let isBilletwebDown = false;
const billetwebStub = vi.fn(async (url: string, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body)) as { data: Array<{ id: number; used: number; lane: string }> };
  checkInCalls.push({ url, data: body.data });
  if (isBilletwebDown) throw new Error("ECONNREFUSED");
  return new Response(JSON.stringify(body.data.map((t) => ({ product_id: String(t.id), state: "1" }))));
});

async function createTicket(options: {
  number?: number | null;
  tier?: "inFlow" | "dedicated" | "none";
  isCancelled?: boolean;
  firstName?: string;
  lastName?: string;
}) {
  const id = String(9_000_000 + stamp++);
  const tier = options.tier ?? "inFlow";
  return prisma.attendee.create({
    data: {
      editionId,
      billetwebId: id,
      barcode: `${YEAR}${id}`,
      firstName: options.firstName ?? "Camille",
      lastName: options.lastName ?? `Test${id}`,
      email: `camille-${id}@example.org`,
      company: "ACME",
      billetwebTicketId: "t1",
      ticketTierId: tier === "inFlow" ? inFlowTierId : tier === "dedicated" ? dedicatedTierId : null,
      orderId: id,
      orderDate: new Date("2026-09-01T10:00:00Z"),
      badgeNumber: options.number ?? null,
      isCancelled: options.isCancelled ?? false,
    },
  });
}

function scan(payload: Record<string, unknown>, as = headers) {
  return app.inject({ method: "POST", url: `/api/arrivals/${editionId}/scan`, headers: as, payload });
}

const waitForCheckIns = () => vi.waitFor(() => expect(isCheckInRunning(editionId)).toBe(false));

beforeAll(async () => {
  process.env.BILLETWEB_USER = "stub-user";
  process.env.BILLETWEB_KEY = "stub-key";
  vi.stubGlobal("fetch", billetwebStub);

  app = Fastify({ logger: false });
  app.decorateRequest("authContext");
  await app.register(arrivalsRoutes, { prefix: "/api" });
  await app.ready();

  editionId = (
    await prisma.edition.create({
      data: { year: YEAR, billetwebEventId: "777", endDate: new Date("2026-11-20T17:00:00Z") },
    })
  ).id;
  const tier = (sortOrder: number, isOutsideFlow: boolean) =>
    prisma.ticketTier.create({
      data: { editionId, nameFr: isOutsideFlow ? "Speaker" : "Standard", nameEn: "x", price: 0, sortOrder, isOutsideFlow },
    });
  inFlowTierId = (await tier(1, false)).id;
  dedicatedTierId = (await tier(2, true)).id;

  volunteerName = `Léa Scan ${Date.now()}`;
  const email = `scan-${Date.now()}@example.org`;
  const user = await prisma.user.create({ data: { email, name: volunteerName, role: "GUEST", emailVerified: true } });
  userIds.push(user.id);
  await prisma.arrivalsAccess.create({ data: { editionId, email, userId: user.id } });
  const key = await generateApiKey(resolveApiKeyEnv());
  await prisma.apiKey.create({ data: { name: `test-${email}`, prefix: key.prefix, hashedKey: key.hashedKey, userId: user.id } });
  headers = { authorization: `Bearer ${key.raw}` };
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await app.close();
  if (editionId !== undefined) {
    await prisma.attendee.deleteMany({ where: { editionId } });
    await prisma.ticketTier.deleteMany({ where: { editionId } });
    await prisma.edition.deleteMany({ where: { id: editionId } });
  }
  if (userIds.length) {
    await prisma.apiKey.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});

beforeEach(() => {
  isBilletwebDown = false;
});

describe("Scanning a ticket at the entrance (#642)", () => {
  it("should give the number, send the badge to its counter and check the ticket in", async () => {
    const ticket = await createTicket({ number: 2105 });

    const res = await scan({ code: ticket.barcode });
    await waitForCheckIns();

    expect(res.json()).toMatchObject({
      result: "badge",
      attendee: { firstName: "Camille", company: "ACME", tierName: "Standard" },
      badge: { number: 2105, state: "TO_FETCH" },
      alreadyScanned: null,
    });
    expect(JSON.stringify(res.json())).not.toContain("@example.org");
    const stored = await prisma.attendee.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(stored.scannedByLabel).toBe(volunteerName);
    expect(stored.checkedInAt).not.toBeNull();
    const call = checkInCalls.find((c) => c.data.some((t) => t.id === Number(ticket.billetwebId)));
    expect(call?.url).toContain("/event/777/check?");
    expect(call?.data.find((t) => t.id === Number(ticket.billetwebId))).toEqual({
      id: Number(ticket.billetwebId),
      used: 1,
      lane: volunteerName,
    });
  });

  it("should alert on a second scan with the first one's time and volunteer, without moving the badge", async () => {
    const ticket = await createTicket({ number: 2106 });
    await scan({ code: ticket.barcode });
    await prisma.attendee.update({ where: { id: ticket.id }, data: { badgeState: "READY", badgeStateVersion: 2 } });

    const res = await scan({ code: ticket.barcode });

    expect(res.json()).toMatchObject({
      result: "badge",
      badge: { state: "READY" },
      alreadyScanned: { by: volunteerName },
    });
  });

  it("should send a ticket without a number to the help desk", async () => {
    const ticket = await createTicket({ number: null });

    const res = await scan({ code: ticket.barcode });

    expect(res.json()).toMatchObject({ result: "help", alreadyScanned: null });
  });

  it("should send a ticket of an unknown tier to the help desk too", async () => {
    const ticket = await createTicket({ number: null, tier: "none" });

    expect((await scan({ code: ticket.barcode })).json()).toMatchObject({ result: "help" });
  });

  it("should tell the dedicated flow apart", async () => {
    const ticket = await createTicket({ number: null, tier: "dedicated" });

    expect((await scan({ code: ticket.barcode })).json()).toMatchObject({ result: "dedicated", attendee: { tierName: "Speaker" } });
  });

  it("should refuse a cancelled ticket, and not check it in", async () => {
    const ticket = await createTicket({ number: 2107, isCancelled: true });

    const res = await scan({ code: ticket.barcode });

    expect(res.json()).toMatchObject({ result: "cancelled" });
    expect((await prisma.attendee.findUniqueOrThrow({ where: { id: ticket.id } })).scannedAt).toBeNull();
  });

  it("should answer unknown for a code no ticket carries", async () => {
    expect((await scan({ code: "0000000000" })).json()).toEqual({ result: "unknown" });
  });

  it("should scan an attendee picked from a name search", async () => {
    const ticket = await createTicket({ number: 2108, firstName: "Hélène", lastName: "Dépôt-Scan" });

    const search = await app.inject({ method: "GET", url: `/api/arrivals/${editionId}/search?q=helene%20depot`, headers });
    const res = await scan({ attendeeId: search.json()[0].id });

    expect(search.json()).toHaveLength(1);
    expect(search.json()[0]).toMatchObject({ id: ticket.id, badgeNumber: 2108, isCancelled: false });
    expect(res.json()).toMatchObject({ result: "badge", badge: { number: 2108, state: "TO_FETCH" } });
  });

  it("should refuse an account without the permission", async () => {
    const outsider = `outsider-${Date.now()}@example.org`;
    const user = await prisma.user.create({ data: { email: outsider, name: outsider, role: "GUEST", emailVerified: true } });
    userIds.push(user.id);
    const key = await generateApiKey(resolveApiKeyEnv());
    await prisma.apiKey.create({ data: { name: `test-${outsider}`, prefix: key.prefix, hashedKey: key.hashedKey, userId: user.id } });

    const res = await scan({ code: "whatever" }, { authorization: `Bearer ${key.raw}` });

    expect(res.statusCode).toBe(403);
  });
});

describe("Checking tickets in on Billetweb (RG-ARR-37)", () => {
  it("should not hold the scan when Billetweb is down, and send the check-in on a later run", async () => {
    isBilletwebDown = true;
    const ticket = await createTicket({ number: 2109 });

    const res = await scan({ code: ticket.barcode });
    await waitForCheckIns();
    const whileDown = await prisma.attendee.findUniqueOrThrow({ where: { id: ticket.id } });
    isBilletwebDown = false;
    await checkInPending(editionId);
    const afterRetry = await prisma.attendee.findUniqueOrThrow({ where: { id: ticket.id } });

    expect(res.json()).toMatchObject({ result: "badge", badge: { state: "TO_FETCH" } });
    expect(whileDown).toMatchObject({ checkedInAt: null, checkInError: "network" });
    expect(afterRetry.checkedInAt).not.toBeNull();
    expect(afterRetry.checkInError).toBeNull();
  });
});

describe("The degraded-mode table (RG-ARR-64, RG-ARR-65)", () => {
  it("should map a code's digest to its number or the dedicated flow, with no name and no code", async () => {
    const numbered = await createTicket({ number: 3101 });
    const dedicated = await createTicket({ number: null, tier: "dedicated" });
    const cancelled = await createTicket({ number: 3102, isCancelled: true });
    const key = (code: string) => createHash("sha256").update(`devfest-arrivals:${editionId}:${code}`).digest("hex").slice(0, 6);

    const res = await app.inject({ method: "GET", url: `/api/arrivals/${editionId}/offline-table`, headers });
    const table = res.json();

    expect(table.entries[key(numbered.barcode)]).toBe(3101);
    expect(table.entries[key(dedicated.barcode)]).toBe(0);
    expect(table.entries[key(cancelled.barcode)]).toBeUndefined();
    expect(table.expiresAt).toBe("2026-11-21T17:00:00.000Z");
    const text = JSON.stringify(table);
    expect(text).not.toContain(numbered.barcode);
    expect(text).not.toContain(numbered.lastName);
  });
});
