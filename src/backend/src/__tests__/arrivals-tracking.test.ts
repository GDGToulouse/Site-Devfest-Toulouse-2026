process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import arrivalsRoutes from "../routes/arrivals.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";
import { prisma } from "../lib/prisma.js";

// The team's tracking screen (#644): its guard, and totals that follow the
// event day without a reload. This file owns the edition year 1651.
const YEAR = 1651;

let app: FastifyInstance;
let baseUrl: string;
let editionId: number;
let dedicatedTierId: number;
const userIds: string[] = [];
let stamp = 0;

async function createAccount(role: "ADMIN" | "EDITOR" | "GUEST", hasAccess = false) {
  const email = `tracking-${role.toLowerCase()}-${Date.now()}-${stamp++}@example.org`;
  const user = await prisma.user.create({ data: { email, name: `Compte ${stamp}`, role, emailVerified: true } });
  userIds.push(user.id);
  if (hasAccess) await prisma.arrivalsAccess.create({ data: { editionId, email, userId: user.id } });
  const key = await generateApiKey(resolveApiKeyEnv());
  await prisma.apiKey.create({ data: { name: `test-${email}`, prefix: key.prefix, hashedKey: key.hashedKey, userId: user.id } });
  return { authorization: `Bearer ${key.raw}` };
}

function createTicket(options: { number?: number; isDedicated?: boolean }) {
  const id = String(7_000_000 + stamp++);
  return prisma.attendee.create({
    data: {
      editionId,
      billetwebId: id,
      barcode: `${YEAR}${id}`,
      firstName: "Camille",
      lastName: `Test${id}`,
      billetwebTicketId: "t1",
      ticketTierId: options.isDedicated ? dedicatedTierId : null,
      orderId: id,
      orderDate: new Date("2026-09-01T10:00:00Z"),
      badgeNumber: options.number ?? null,
    },
  });
}

// An open stream, read summary by summary as the browser's EventSource would.
async function openTracking(headers: Record<string, string>) {
  const controller = new AbortController();
  const res = await fetch(`${baseUrl}/api/arrivals/${editionId}/tracking`, { headers, signal: controller.signal });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  async function next(): Promise<Record<string, any>> {
    for (;;) {
      const end = buffer.indexOf("\n\n");
      if (end >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = /^event: summary\ndata: (.*)$/m.exec(block)?.[1];
        if (data) return JSON.parse(data);
        continue;
      }
      const { value, done } = await reader.read();
      if (done) throw new Error("stream ended");
      buffer += decoder.decode(value, { stream: true });
    }
  }

  return { res, next, close: () => controller.abort() };
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.decorateRequest("authContext");
  await app.register(arrivalsRoutes, { prefix: "/api" });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  editionId = (await prisma.edition.create({ data: { year: YEAR, badgeCounters: 2, badgeBinsPerCounter: 3 } })).id;
  dedicatedTierId = (
    await prisma.ticketTier.create({
      data: { editionId, nameFr: "Speaker", nameEn: "Speaker", price: 0, sortOrder: 1, isOutsideFlow: true },
    })
  ).id;
});

afterAll(async () => {
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

describe("The tracking screen (#644)", () => {
  it("should be closed to a volunteer, even one holding the arrivals permission (RG-ARR-26)", async () => {
    const volunteer = await createAccount("GUEST", true);

    const anonymous = await app.inject({ method: "GET", url: `/api/arrivals/${editionId}/tracking` });
    const asVolunteer = await app.inject({ method: "GET", url: `/api/arrivals/${editionId}/tracking`, headers: volunteer });

    expect([anonymous.statusCode, asVolunteer.statusCode]).toEqual([401, 403]);
  });

  it("should tell the page ahead whether the account may open it", async () => {
    const editor = await createAccount("EDITOR");
    const volunteer = await createAccount("GUEST", true);

    const asEditor = await app.inject({ method: "GET", url: "/api/arrivals/current", headers: editor });
    const asVolunteer = await app.inject({ method: "GET", url: "/api/arrivals/current", headers: volunteer });

    expect([asEditor.json().canTrack, asVolunteer.json().canTrack]).toEqual([true, false]);
  });

  it("should follow scans and moves without a reload, the dedicated flow included", async () => {
    const editor = await createAccount("EDITOR");
    const volunteer = await createAccount("GUEST", true);
    const badge = await createTicket({ number: 1000 });
    const speaker = await createTicket({ isDedicated: true });
    const stream = await openTracking(editor);
    const first = await stream.next();

    await app.inject({
      method: "POST",
      url: `/api/arrivals/${editionId}/scan`,
      headers: volunteer,
      payload: { attendeeId: badge.id },
    });
    const afterScan = await stream.next();
    await app.inject({
      method: "POST",
      url: `/api/arrivals/${editionId}/scan`,
      headers: volunteer,
      payload: { attendeeId: speaker.id },
    });
    const afterSpeaker = await stream.next();
    stream.close();

    expect(stream.res.status).toBe(200);
    expect(first).toMatchObject({ expected: 1, scanned: 0, waiting: 0, dedicated: { expected: 1, scanned: 0 } });
    expect(afterScan).toMatchObject({ scanned: 1, waiting: 1 });
    expect(afterScan.counters[0]).toMatchObject({ counter: 1, toFetch: 1 });
    expect(afterSpeaker.dedicated).toEqual({ expected: 1, scanned: 1 });
  });

  it("should carry no name", async () => {
    const admin = await createAccount("ADMIN");
    const stream = await openTracking(admin);

    const summary = await stream.next();
    stream.close();

    expect(JSON.stringify(summary)).not.toContain("Camille");
  });
});
