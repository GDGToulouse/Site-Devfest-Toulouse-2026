process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import arrivalsRoutes from "../routes/arrivals.js";
import { subscribeToArrivals, type ArrivalsEvent } from "../lib/arrivals-stream.js";
import { isCheckInRunning } from "../lib/billetweb-checkin.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";
import { prisma } from "../lib/prisma.js";

// The help desk (#713): labels printed and handed over, and what that does to
// the other screens. Billetweb is a stub. This file owns the edition year 1649.
const YEAR = 1649;

let app: FastifyInstance;
let editionId: number;
let inFlowTierId: number;
let dedicatedTierId: number;
let headers: Record<string, string>;
let volunteerName: string;
const userIds: string[] = [];
let stamp = 0;

const checkedIn: number[] = [];
const billetwebStub = vi.fn(async (_url: string, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body)) as { data: Array<{ id: number }> };
  checkedIn.push(...body.data.map((t) => t.id));
  return new Response(JSON.stringify(body.data.map((t) => ({ product_id: String(t.id), state: "1" }))));
});

async function createTicket(options: {
  number?: number | null;
  state?: "PRINTED" | "TO_FETCH" | "READY";
  tier?: "inFlow" | "dedicated";
  isCancelled?: boolean;
  isScanned?: boolean;
}) {
  const id = String(8_000_000 + stamp++);
  return prisma.attendee.create({
    data: {
      editionId,
      billetwebId: id,
      barcode: `${YEAR}${id}`,
      firstName: "Paul",
      lastName: `Test${id}`,
      email: `paul-${id}@example.org`,
      company: "Capitole Cloud",
      billetwebTicketId: "t1",
      ticketTierId: options.tier === "dedicated" ? dedicatedTierId : inFlowTierId,
      orderId: id,
      orderDate: new Date("2026-09-01T10:00:00Z"),
      badgeNumber: options.number ?? null,
      badgeState: options.state ?? "PRINTED",
      isCancelled: options.isCancelled ?? false,
      scannedAt: options.isScanned ? new Date() : null,
    },
  });
}

const print = (attendeeId: number) =>
  app.inject({ method: "POST", url: `/api/arrivals/${editionId}/attendees/${attendeeId}/label`, headers });
const deliver = (attendeeId: number) =>
  app.inject({ method: "POST", url: `/api/arrivals/${editionId}/attendees/${attendeeId}/label/delivered`, headers });

// What the other screens hear while `act` runs.
async function heardDuring(act: () => Promise<unknown>) {
  const events: ArrivalsEvent[] = [];
  const unsubscribe = subscribeToArrivals(editionId, (event) => events.push(event));
  try {
    await act();
  } finally {
    unsubscribe();
  }
  return events;
}

beforeAll(async () => {
  process.env.BILLETWEB_USER = "stub-user";
  process.env.BILLETWEB_KEY = "stub-key";
  vi.stubGlobal("fetch", billetwebStub);

  app = Fastify({ logger: false });
  app.decorateRequest("authContext");
  await app.register(arrivalsRoutes, { prefix: "/api" });
  await app.ready();

  editionId = (await prisma.edition.create({ data: { year: YEAR, billetwebEventId: "777" } })).id;
  const tier = (sortOrder: number, isOutsideFlow: boolean) =>
    prisma.ticketTier.create({
      data: { editionId, nameFr: isOutsideFlow ? "Speaker" : "Standard", nameEn: "x", price: 0, sortOrder, isOutsideFlow },
    });
  inFlowTierId = (await tier(1, false)).id;
  dedicatedTierId = (await tier(2, true)).id;

  volunteerName = `Valentin Aide ${Date.now()}`;
  const email = `aide-${Date.now()}@example.org`;
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

describe("Labels at the help desk (#713)", () => {
  it("should give the text to print and trace each print, reprints included", async () => {
    const ticket = await createTicket({ isScanned: true });

    const first = await print(ticket.id);
    const second = await print(ticket.id);

    expect(first.json()).toEqual({ label: { firstName: "Paul", lastName: ticket.lastName, company: "Capitole Cloud" }, printCount: 1 });
    expect(second.json().printCount).toBe(2);
    const trace = await prisma.badgeLabel.findMany({ where: { attendeeId: ticket.id } });
    expect(trace).toHaveLength(2);
    expect(trace[0]).toMatchObject({ userId: userIds[0], userLabel: volunteerName });
  });

  it("should refuse a label for a cancelled ticket and for the dedicated flow", async () => {
    const cancelled = await createTicket({ isCancelled: true });
    const dedicated = await createTicket({ tier: "dedicated" });

    const res = [await print(cancelled.id), await print(dedicated.id)];

    expect(res.map((r) => [r.statusCode, r.json().error])).toEqual([
      [409, "cancelled"],
      [409, "dedicated"],
    ]);
    expect(await prisma.badgeLabel.count({ where: { attendeeId: { in: [cancelled.id, dedicated.id] } } })).toBe(0);
  });

  it("should refuse to hand over a label never printed", async () => {
    const ticket = await createTicket({ isScanned: true });

    const res = await deliver(ticket.id);

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("not_printed");
  });

  it("should take a ticket without a number off the 'to handle' list once its label is handed over", async () => {
    const ticket = await createTicket({ isScanned: true });
    await print(ticket.id);

    const events = await heardDuring(() => deliver(ticket.id));

    expect(events).toEqual([
      { type: "help", data: expect.objectContaining({ id: ticket.id, labelDeliveredAt: expect.any(Date) }) },
    ]);
  });

  it("should take a badge that could not be found off its counter, and count it apart", async () => {
    const ticket = await createTicket({ number: 2147, state: "TO_FETCH", isScanned: true });
    await print(ticket.id);

    const events = await heardDuring(() => deliver(ticket.id));

    expect(events).toEqual([
      {
        type: "badge",
        data: expect.objectContaining({ id: ticket.id, state: "DELIVERED", byLabel: true, version: 1 }),
      },
    ]);
    const history = await prisma.badgeTransition.findMany({ where: { attendeeId: ticket.id } });
    expect(history.map((t) => [t.fromState, t.toState, t.userLabel])).toEqual([["TO_FETCH", "DELIVERED", volunteerName]]);
  });

  it("should change nothing on a second hand-over, nor on a reprint after it", async () => {
    const ticket = await createTicket({ number: 2148, state: "READY", isScanned: true });
    await print(ticket.id);
    await deliver(ticket.id);
    const before = await prisma.attendee.findUniqueOrThrow({ where: { id: ticket.id } });

    const events = await heardDuring(async () => {
      await print(ticket.id);
      expect((await deliver(ticket.id)).statusCode).toBe(200);
    });

    const after = await prisma.attendee.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(events).toEqual([]);
    expect([after.badgeStateVersion, after.labelDeliveredAt]).toEqual([before.badgeStateVersion, before.labelDeliveredAt]);
  });

  it("should count someone who came straight to the help desk as arrived, and check them in", async () => {
    const ticket = await createTicket({});
    await print(ticket.id);

    await deliver(ticket.id);
    await vi.waitFor(() => expect(isCheckInRunning(editionId)).toBe(false));

    const row = await prisma.attendee.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(row.scannedByLabel).toBe(volunteerName);
    expect(checkedIn).toContain(Number(ticket.billetwebId));
  });

  it("should give a label's badge back to its counter if it moves again", async () => {
    const ticket = await createTicket({ number: 2149, state: "READY", isScanned: true });
    await print(ticket.id);
    await deliver(ticket.id);

    const res = await app.inject({
      method: "POST",
      url: `/api/arrivals/${editionId}/badges/${ticket.id}/move`,
      headers,
      payload: { from: "DELIVERED", to: "READY" },
    });

    expect(res.json()).toMatchObject({ applied: true, badge: { state: "READY", byLabel: false } });
  });

  it("should show the help desk where everyone stands in a name search", async () => {
    const ticket = await createTicket({ number: 2150, state: "READY", isScanned: true });
    await print(ticket.id);

    const res = await app.inject({
      method: "GET",
      url: `/api/arrivals/${editionId}/search?q=${encodeURIComponent(ticket.lastName)}`,
      headers,
    });

    expect(res.json()).toEqual([
      expect.objectContaining({ id: ticket.id, badgeNumber: 2150, badgeState: "READY", labelCount: 1, labelDeliveredAt: null }),
    ]);
  });
});
