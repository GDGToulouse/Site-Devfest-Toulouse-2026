process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import arrivalsRoutes from "../routes/arrivals.js";
import adminArrivalsStationRoutes from "../routes/admin/arrivals-stations.js";
import { requireAdmin } from "../lib/admin-guard.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";
import { deriveStationToken, type Station } from "../lib/arrivals-station.js";
import { prisma } from "../lib/prisma.js";

// Station access without an account (#775): the exchange of a QR code for a
// session, its window and regeneration, and what a station may not do. This
// file owns the edition year 1655.
const YEAR = 1655;
const DAY = 24 * 60 * 60 * 1000;

let app: FastifyInstance;
let editionId: number;
let userId: string;
let admin: { authorization: string };
let stamp = 0;

const counter = (n: number): Station => ({ kind: "counter", counter: n });

async function generation() {
  return (await prisma.edition.findUniqueOrThrow({ where: { id: editionId } })).stationAccessGeneration;
}

async function tokenOf(station: Station) {
  return deriveStationToken(editionId, station, await generation());
}

async function exchange(token: string) {
  return app.inject({ method: "POST", url: "/api/arrivals/station-session", payload: { token } });
}

// The cookie a browser would send back after the exchange.
async function sessionOf(station: Station) {
  const res = await exchange(await tokenOf(station));
  const pair = String(res.headers["set-cookie"]).split(";")[0];
  return { cookie: pair };
}

function openWindow() {
  return prisma.edition.update({
    where: { id: editionId },
    data: { stationAccessFrom: new Date(Date.now() - DAY), stationAccessUntil: new Date(Date.now() + DAY) },
  });
}

function createTicket(number: number | null, state: "PRINTED" | "TO_FETCH" = "TO_FETCH") {
  const id = String(8_000_000 + stamp++);
  return prisma.attendee.create({
    data: {
      editionId,
      billetwebId: id,
      barcode: `${YEAR}${id}`,
      firstName: "Camille",
      lastName: `Test${id}`,
      billetwebTicketId: "t1",
      orderId: id,
      orderDate: new Date("2026-09-01T10:00:00Z"),
      badgeNumber: number,
      badgeState: state,
    },
  });
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.decorateRequest("authContext");
  await app.register(arrivalsRoutes, { prefix: "/api" });
  await app.register(
    async (adminApp) => {
      adminApp.addHook("preHandler", requireAdmin);
      await adminApp.register(adminArrivalsStationRoutes);
    },
    { prefix: "/api/admin" },
  );
  editionId = (await prisma.edition.create({ data: { year: YEAR, badgeCounters: 2, badgeBinsPerCounter: 3 } })).id;
  const user = await prisma.user.create({
    data: { email: `station-admin-${Date.now()}@example.org`, name: "Admin test", role: "ADMIN", emailVerified: true },
  });
  userId = user.id;
  const key = await generateApiKey(resolveApiKeyEnv());
  await prisma.apiKey.create({ data: { name: "station-test", prefix: key.prefix, hashedKey: key.hashedKey, userId } });
  admin = { authorization: `Bearer ${key.raw}` };
});

beforeEach(async () => {
  await openWindow();
});

afterAll(async () => {
  await app.close();
  if (editionId !== undefined) {
    await prisma.badgeTransition.deleteMany({ where: { attendee: { editionId } } });
    await prisma.attendee.deleteMany({ where: { editionId } });
    await prisma.edition.deleteMany({ where: { id: editionId } });
  }
  if (userId !== undefined) {
    await prisma.apiKey.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
});

describe("Opening a station with its QR code (RG-ARR-70)", () => {
  it("should open the station inside the window, with an HttpOnly cookie bound to the arrivals API", async () => {
    const res = await exchange(await tokenOf(counter(2)));

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ editionId, station: { kind: "counter", counter: 2 }, path: "/arrivees/guichet/2" });
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/api/arrivals");
  });

  it("should tell the page which station it is locked to", async () => {
    const session = await sessionOf({ kind: "help" });

    const res = await app.inject({ method: "GET", url: "/api/arrivals/current", headers: session });

    expect(res.json()).toMatchObject({ edition: { id: editionId }, hasAccess: true, canTrack: false, station: { kind: "help" } });
  });

  it("should refuse a link that was not signed by the server", async () => {
    const forged = (await tokenOf(counter(1))).replace(/.$/, (c) => (c === "A" ? "B" : "A"));

    const res = await exchange(forged);

    expect([res.statusCode, res.json().error]).toEqual([403, "station_invalid"]);
  });

  it("should refuse a station the layout does not have", async () => {
    const res = await exchange(deriveStationToken(editionId, counter(7), await generation()));

    expect(res.json().error).toBe("station_invalid");
  });

  it("should refuse a link after the window, with a clear message (RG-ARR-71)", async () => {
    await prisma.edition.update({ where: { id: editionId }, data: { stationAccessUntil: new Date(Date.now() - 1000) } });

    const res = await exchange(await tokenOf({ kind: "scan" }));

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: "station_closed", message: expect.stringContaining("terminé") });
  });

  it("should refuse a link before the window opens, and say when it opens", async () => {
    await prisma.edition.update({
      where: { id: editionId },
      data: { stationAccessFrom: new Date(Date.now() + DAY), stationAccessUntil: new Date(Date.now() + 2 * DAY) },
    });

    const res = await exchange(await tokenOf({ kind: "scan" }));

    expect(res.json()).toMatchObject({ error: "station_not_open_yet", message: expect.stringContaining("ouvre le") });
  });

  it("should end an open session when the window closes", async () => {
    const session = await sessionOf({ kind: "scan" });
    await prisma.edition.update({ where: { id: editionId }, data: { stationAccessUntil: new Date(Date.now() - 1000) } });

    const res = await app.inject({ method: "GET", url: "/api/arrivals/current", headers: session });

    expect([res.statusCode, res.json().error]).toEqual([403, "station_closed"]);
  });
});

describe("Regenerating the links (RG-ARR-75)", () => {
  it("should refuse the old QR codes and end the sessions they opened", async () => {
    const station = counter(1);
    const oldToken = await tokenOf(station);
    const session = await sessionOf(station);

    const regenerated = await app.inject({ method: "POST", url: `/api/admin/arrivals-stations/${editionId}/regenerate`, headers: admin });
    const afterToken = await exchange(oldToken);
    const afterSession = await app.inject({ method: "GET", url: "/api/arrivals/current", headers: session });
    const afterStream = await app.inject({ method: "GET", url: `/api/arrivals/${editionId}/stream`, headers: session });

    expect(regenerated.statusCode).toBe(200);
    expect(afterToken.json().error).toBe("station_replaced");
    expect([afterSession.statusCode, afterSession.json().error]).toEqual([403, "station_replaced"]);
    expect(afterStream.statusCode).toBe(403);
  });

  it("should give new codes that work", async () => {
    await app.inject({ method: "POST", url: `/api/admin/arrivals-stations/${editionId}/regenerate`, headers: admin });

    const res = await exchange(await tokenOf(counter(1)));

    expect(res.statusCode).toBe(200);
  });

  it("should list the same links until the next regeneration, so the sheets can be printed again", async () => {
    const first = await app.inject({ method: "GET", url: `/api/admin/arrivals-stations/${editionId}`, headers: admin });
    const second = await app.inject({ method: "GET", url: `/api/admin/arrivals-stations/${editionId}`, headers: admin });

    const urls = (res: typeof first) => res.json().stations.map((s: { url: string }) => s.url);
    expect(urls(first)).toEqual(urls(second));
    // Scan, Aide, then one per counter: the bins have no station of their own.
    expect(urls(first)).toHaveLength(2 + 2);
  });

  it("should refuse a window that ends before it starts", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/arrivals-stations/${editionId}/window`,
      headers: admin,
      payload: { from: new Date(Date.now() + DAY).toISOString(), until: new Date(Date.now() - DAY).toISOString() },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("What a station may not do (RG-ARR-72)", () => {
  it("should be refused by the back-office, including the station links themselves", async () => {
    const session = await sessionOf(counter(1));

    const res = await app.inject({ method: "GET", url: `/api/admin/arrivals-stations/${editionId}`, headers: session });

    // The back-office does not know the cookie: it answers an anonymous caller.
    expect(res.statusCode).toBe(403);
  });

  it("should be refused the tracking stream, whatever the station", async () => {
    const session = await sessionOf({ kind: "help" });

    const res = await app.inject({ method: "GET", url: `/api/arrivals/${editionId}/tracking`, headers: session });

    expect(res.statusCode).toBe(403);
  });

  it("should be refused another edition", async () => {
    const session = await sessionOf({ kind: "scan" });

    const res = await app.inject({ method: "GET", url: `/api/arrivals/${editionId + 1}/offline-table`, headers: session });

    expect(res.statusCode).toBe(403);
  });

  it("should be refused another station's routes", async () => {
    const badge = await createTicket(1001);
    const scanSession = await sessionOf({ kind: "scan" });
    const counterSession = await sessionOf(counter(1));
    const helpSession = await sessionOf({ kind: "help" });

    const scanMoves = await app.inject({
      method: "POST",
      url: `/api/arrivals/${editionId}/badges/${badge.id}/move`,
      headers: scanSession,
      payload: { from: "TO_FETCH", to: "READY" },
    });
    const counterScans = await app.inject({
      method: "POST",
      url: `/api/arrivals/${editionId}/scan`,
      headers: counterSession,
      payload: { attendeeId: badge.id },
    });
    const counterLabels = await app.inject({
      method: "POST",
      url: `/api/arrivals/${editionId}/attendees/${badge.id}/label`,
      headers: counterSession,
    });
    const helpMoves = await app.inject({
      method: "POST",
      url: `/api/arrivals/${editionId}/badges/${badge.id}/move`,
      headers: helpSession,
      payload: { from: "TO_FETCH", to: "READY" },
    });

    expect([scanMoves.statusCode, counterScans.statusCode, counterLabels.statusCode, helpMoves.statusCode]).toEqual([
      403, 403, 403, 403,
    ]);
  });

  it("should let a counter move its own badges only", async () => {
    const own = await createTicket(1002);
    const other = await createTicket(2002);
    const session = await sessionOf(counter(1));
    const move = (id: number) =>
      app.inject({
        method: "POST",
        url: `/api/arrivals/${editionId}/badges/${id}/move`,
        headers: session,
        payload: { from: "TO_FETCH", to: "READY" },
      });

    const ownRes = await move(own.id);
    const otherRes = await move(other.id);

    expect([ownRes.statusCode, otherRes.statusCode]).toEqual([200, 403]);
    expect((await prisma.attendee.findUniqueOrThrow({ where: { id: other.id } })).badgeState).toBe("TO_FETCH");
  });

  it("should let a counter's station move the badges of every one of its bins", async () => {
    const inBin = await createTicket(1203);
    const inOtherBin = await createTicket(1303);
    const session = await sessionOf(counter(1));
    const move = (id: number) =>
      app.inject({
        method: "POST",
        url: `/api/arrivals/${editionId}/badges/${id}/move`,
        headers: session,
        payload: { from: "TO_FETCH", to: "READY" },
      });

    const results = [(await move(inBin.id)).statusCode, (await move(inOtherBin.id)).statusCode];

    expect(results).toEqual([200, 200]);
  });

  it("should never take a badge back to Imprimé, as an admin may", async () => {
    const badge = await createTicket(1004, "TO_FETCH");
    const session = await sessionOf(counter(1));

    const res = await app.inject({
      method: "POST",
      url: `/api/arrivals/${editionId}/badges/${badge.id}/move`,
      headers: session,
      payload: { from: "TO_FETCH", to: "PRINTED" },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("Cancelling a scan from a station (#797)", () => {
  it("should let the Scan station undo its own scan, and no other station", async () => {
    const badge = await createTicket(1003, "PRINTED");
    const scanSession = await sessionOf({ kind: "scan" });
    await app.inject({ method: "POST", url: `/api/arrivals/${editionId}/scan`, headers: scanSession, payload: { attendeeId: badge.id } });
    const url = `/api/arrivals/${editionId}/attendees/${badge.id}/cancel-scan`;

    const byHelp = await app.inject({ method: "POST", url, headers: await sessionOf({ kind: "help" }) });
    const byCounter = await app.inject({ method: "POST", url, headers: await sessionOf(counter(1)) });
    const byScan = await app.inject({ method: "POST", url, headers: scanSession });

    expect([byHelp.statusCode, byCounter.statusCode, byScan.statusCode]).toEqual([403, 403, 200]);
    expect(await prisma.attendee.findUniqueOrThrow({ where: { id: badge.id } })).toMatchObject({
      scannedAt: null,
      badgeState: "PRINTED",
    });
  });
});

describe("What a counter may look up (#802)", () => {
  it("should let a counter find a person of another counter, without moving their badge", async () => {
    const other = await createTicket(2105);
    const session = await sessionOf(counter(1));

    const search = await app.inject({
      method: "GET",
      url: `/api/arrivals/${editionId}/search?q=${encodeURIComponent(other.lastName)}`,
      headers: session,
    });
    const move = await app.inject({
      method: "POST",
      url: `/api/arrivals/${editionId}/badges/${other.id}/move`,
      headers: session,
      payload: { from: "TO_FETCH", to: "READY" },
    });

    expect(search.statusCode).toBe(200);
    expect(search.json()).toMatchObject([{ id: other.id, badgeNumber: 2105 }]);
    expect(move.statusCode).toBe(403);
  });

  it("should find a badge by its number, typed as it is printed", async () => {
    const ticket = await createTicket(2247);
    const session = await sessionOf(counter(2));

    const res = await app.inject({ method: "GET", url: `/api/arrivals/${editionId}/search?q=2%202%2047`, headers: session });

    expect(res.json()).toMatchObject([{ id: ticket.id, badgeNumber: 2247 }]);
  });
});

describe("Who the history names (RG-ARR-76)", () => {
  it("should record a counter's move under the station, with no account", async () => {
    const badge = await createTicket(1005);
    const session = await sessionOf(counter(1));

    await app.inject({
      method: "POST",
      url: `/api/arrivals/${editionId}/badges/${badge.id}/move`,
      headers: session,
      payload: { from: "TO_FETCH", to: "READY" },
    });

    const transition = await prisma.badgeTransition.findFirstOrThrow({ where: { attendeeId: badge.id } });
    expect([transition.userId, transition.userLabel]).toEqual([null, "Poste Guichet 1"]);
  });

  it("should record a scan under the Scan station", async () => {
    const badge = await createTicket(1006, "PRINTED");
    const session = await sessionOf({ kind: "scan" });

    const res = await app.inject({
      method: "POST",
      url: `/api/arrivals/${editionId}/scan`,
      headers: session,
      payload: { attendeeId: badge.id },
    });

    expect(res.statusCode).toBe(200);
    expect((await prisma.attendee.findUniqueOrThrow({ where: { id: badge.id } })).scannedByLabel).toBe("Poste Scan");
  });
});
