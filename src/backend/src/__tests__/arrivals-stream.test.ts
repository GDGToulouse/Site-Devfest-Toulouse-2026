process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import arrivalsRoutes from "../routes/arrivals.js";
import { countArrivalsListeners } from "../lib/arrivals-stream.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";
import { prisma } from "../lib/prisma.js";

// The arrivals screens' live state (#641): the stream, the moves, the
// resynchronization. This file owns the edition years 1646 and 1648.
const YEAR = 1646;
// Under 2016, like every test edition: getSeededEdition() takes the newest
// from 2016 on, and other files would pick this one up as it gets deleted.
const OTHER_YEAR = 1648;

let app: FastifyInstance;
let baseUrl: string;
let editionId: number;
const userIds: string[] = [];
let stamp = 0;

async function createAccount(role: "ADMIN" | "GUEST", hasAccess: boolean) {
  const email = `stream-${role.toLowerCase()}-${Date.now()}-${stamp++}@example.org`;
  const user = await prisma.user.create({ data: { email, name: `Bénévole ${stamp}`, role, emailVerified: true } });
  userIds.push(user.id);
  if (hasAccess) await prisma.arrivalsAccess.create({ data: { editionId, email, userId: user.id } });
  const key = await generateApiKey(resolveApiKeyEnv());
  await prisma.apiKey.create({ data: { name: `test-${email}`, prefix: key.prefix, hashedKey: key.hashedKey, userId: user.id } });
  return { user, headers: { authorization: `Bearer ${key.raw}` } };
}

async function createBadge(number: number, state: "PRINTED" | "TO_FETCH" | "READY" = "PRINTED") {
  const id = `${YEAR}-${number}-${stamp++}`;
  return prisma.attendee.create({
    data: {
      editionId,
      billetwebId: id,
      barcode: `code-${id}`,
      firstName: "Camille",
      lastName: `Test ${number}`,
      email: `camille-${id}@example.org`,
      company: "ACME",
      billetwebTicketId: "t1",
      orderId: id,
      orderDate: new Date("2026-09-01T10:00:00Z"),
      badgeNumber: number,
      badgeState: state,
    },
  });
}

interface StreamEvent {
  event: string;
  data: unknown;
}

// An open stream, read event by event as the browser's EventSource would.
async function openStream(headers: Record<string, string>) {
  const controller = new AbortController();
  const res = await fetch(`${baseUrl}/api/arrivals/${editionId}/stream`, { headers, signal: controller.signal });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const received: StreamEvent[] = [];

  async function next(name: string): Promise<StreamEvent> {
    for (;;) {
      const index = received.findIndex((e) => e.event === name);
      if (index >= 0) return received.splice(index, 1)[0];
      const { value, done } = await reader.read();
      if (done) throw new Error(`stream ended before "${name}"`);
      buffer += decoder.decode(value, { stream: true });
      let end;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const event = /^event: (.*)$/m.exec(block)?.[1];
        const data = /^data: (.*)$/m.exec(block)?.[1];
        if (event && data) received.push({ event, data: JSON.parse(data) });
      }
    }
  }

  return { res, next, close: () => controller.abort() };
}

function move(headers: Record<string, string>, attendeeId: number, from: string, to: string) {
  return app.inject({
    method: "POST",
    url: `/api/arrivals/${editionId}/badges/${attendeeId}/move`,
    headers,
    payload: { from, to },
  });
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.decorateRequest("authContext");
  await app.register(arrivalsRoutes, { prefix: "/api" });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  editionId = (await prisma.edition.create({ data: { year: YEAR, badgeCounters: 2, badgeBinsPerCounter: 3 } })).id;
});

afterAll(async () => {
  await app.close();
  if (editionId !== undefined) await prisma.edition.deleteMany({ where: { id: editionId } });
  if (userIds.length) {
    await prisma.apiKey.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});

describe("The arrivals stream (#641)", () => {
  it("should refuse an anonymous caller and an account without the permission", async () => {
    const outsider = await createAccount("GUEST", false);

    expect((await app.inject({ method: "GET", url: `/api/arrivals/${editionId}/stream` })).statusCode).toBe(401);
    const res = await app.inject({ method: "GET", url: `/api/arrivals/${editionId}/stream`, headers: outsider.headers });
    expect(res.statusCode).toBe(403);
  });

  it("should open with the full state: badges that left Imprimé, without their email", async () => {
    const volunteer = await createAccount("GUEST", true);
    const waiting = await createBadge(1101, "TO_FETCH");
    const printed = await createBadge(1102);

    const stream = await openStream(volunteer.headers);
    const { data } = await stream.next("snapshot");
    stream.close();

    expect(stream.res.headers.get("content-type")).toContain("text/event-stream");
    const snapshot = data as { layout: unknown; badges: Array<Record<string, unknown>> };
    expect(snapshot.layout).toEqual({ counters: 2, binsPerCounter: 3 });
    const ids = snapshot.badges.map((b) => b.id);
    expect(ids).toContain(waiting.id);
    expect(ids).not.toContain(printed.id);
    expect(JSON.stringify(snapshot)).not.toContain("@example.org");
  });

  it("should carry a move made on one screen to the others", async () => {
    const counter = await createAccount("GUEST", true);
    const otherScreen = await createAccount("GUEST", true);
    const badge = await createBadge(1201, "TO_FETCH");
    const stream = await openStream(otherScreen.headers);
    const { data: snapshot } = await stream.next("snapshot");
    const before = (snapshot as { badges: Array<{ id: number; version: number }> }).badges.find((b) => b.id === badge.id);

    const res = await move(counter.headers, badge.id, "TO_FETCH", "READY");
    const { data } = await stream.next("badge");
    stream.close();

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ applied: true, badge: { id: badge.id, state: "READY" } });
    expect(data).toMatchObject({ id: badge.id, number: 1201, state: "READY", version: before!.version + 1 });
  });

  it("should ignore a move whose starting state is stale, and answer the badge as it stands", async () => {
    const counter = await createAccount("GUEST", true);
    const badge = await createBadge(1202, "TO_FETCH");
    await move(counter.headers, badge.id, "TO_FETCH", "READY");

    // The same card touched on a second screen that had not caught up (RG-ARR-44).
    const res = await move(counter.headers, badge.id, "TO_FETCH", "READY");

    expect(res.json()).toMatchObject({ applied: false, badge: { state: "READY", version: 1 } });
    expect(await prisma.badgeTransition.count({ where: { attendeeId: badge.id } })).toBe(1);
  });

  it("should record when and by whom each step happened", async () => {
    const counter = await createAccount("GUEST", true);
    const badge = await createBadge(1203, "READY");

    await move(counter.headers, badge.id, "READY", "DELIVERED");
    await move(counter.headers, badge.id, "DELIVERED", "READY");

    const history = await prisma.badgeTransition.findMany({ where: { attendeeId: badge.id }, orderBy: { id: "asc" } });
    expect(history.map((t) => [t.fromState, t.toState])).toEqual([
      ["READY", "DELIVERED"],
      ["DELIVERED", "READY"],
    ]);
    expect(history[0]).toMatchObject({ userId: counter.user.id, userLabel: counter.user.name });
  });

  it("should keep the scan's move and the return to Imprimé off a volunteer's screen", async () => {
    const volunteer = await createAccount("GUEST", true);
    const printed = await createBadge(1204);
    const waiting = await createBadge(1205, "TO_FETCH");

    expect((await move(volunteer.headers, printed.id, "PRINTED", "TO_FETCH")).statusCode).toBe(400);
    expect((await move(volunteer.headers, waiting.id, "TO_FETCH", "PRINTED")).statusCode).toBe(400);
    expect((await move(volunteer.headers, waiting.id, "TO_FETCH", "DELIVERED")).statusCode).toBe(400);
  });

  it("should let an admin take a badge back one step, to Imprimé included", async () => {
    const admin = await createAccount("ADMIN", false);
    const waiting = await createBadge(1206, "TO_FETCH");

    const res = await move(admin.headers, waiting.id, "TO_FETCH", "PRINTED");

    expect(res.json()).toMatchObject({ applied: true, badge: { state: "PRINTED" } });
  });

  it("should not move a badge of another edition through this one", async () => {
    const volunteer = await createAccount("GUEST", true);
    const other = await prisma.edition.create({ data: { year: OTHER_YEAR } });
    try {
      const foreign = await prisma.attendee.create({
        data: {
          editionId: other.id,
          billetwebId: "foreign",
          barcode: "foreign",
          firstName: "A",
          lastName: "B",
          billetwebTicketId: "t1",
          orderId: "o",
          orderDate: new Date(),
          badgeNumber: 1101,
          badgeState: "TO_FETCH",
        },
      });

      const res = await move(volunteer.headers, foreign.id, "TO_FETCH", "READY");

      expect(res.statusCode).toBe(404);
    } finally {
      await prisma.edition.delete({ where: { id: other.id } });
    }
  });

  it("should resend the full state on reconnection, moves made during the break included", async () => {
    const volunteer = await createAccount("GUEST", true);
    const counter = await createAccount("GUEST", true);
    const badge = await createBadge(1207, "TO_FETCH");
    const first = await openStream(volunteer.headers);
    await first.next("snapshot");
    const listenersBefore = countArrivalsListeners(editionId);

    first.close();
    await vi.waitFor(() => expect(countArrivalsListeners(editionId)).toBe(listenersBefore - 1));
    await move(counter.headers, badge.id, "TO_FETCH", "READY");
    const second = await openStream(volunteer.headers);
    const { data } = await second.next("snapshot");
    second.close();

    const seen = (data as { badges: Array<{ id: number; state: string }> }).badges.find((b) => b.id === badge.id);
    expect(seen?.state).toBe("READY");
  });
});
