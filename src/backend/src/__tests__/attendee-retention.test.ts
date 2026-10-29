process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";

import adminAttendeeRoutes from "../routes/admin/attendees.js";
import { purgeExpiredAttendees } from "../lib/attendee-retention.js";
import { prisma } from "../lib/prisma.js";

// Attendees deleted 18 months after their event (RG-ARR-66). This file owns
// the edition years 1652 to 1654. Their events are dated in the 13th century
// and the purge runs "in 1240": no other suite's edition is that old, so the
// purge, which sweeps every edition, cannot reach theirs.
const NOW = new Date("1240-01-01T00:00:00Z");

let expiredId: number;
let recentId: number;
let undatedId: number;
let stamp = 0;

const addAttendee = (editionId: number) => {
  const id = `retention-${editionId}-${stamp++}`;
  return prisma.attendee.create({
    data: {
      editionId,
      billetwebId: id,
      barcode: id,
      firstName: "Camille",
      lastName: "Test",
      email: `${id}@example.org`,
      billetwebTicketId: "t1",
      orderId: id,
      orderDate: new Date("2026-09-01T10:00:00Z"),
      badgeNumber: 1000,
    },
  });
};

beforeAll(async () => {
  const create = (year: number, endDate: Date | null) =>
    prisma.edition.create({ data: { year, endDate, billetwebEventId: `evt-${year}` } });
  expiredId = (await create(1652, new Date("1238-06-01T17:00:00Z"))).id;
  recentId = (await create(1653, new Date("1238-08-01T17:00:00Z"))).id;
  undatedId = (await create(1654, null)).id;
  for (const id of [expiredId, recentId, undatedId]) await addAttendee(id);
});

afterAll(async () => {
  const ids = [expiredId, recentId, undatedId].filter((id) => id !== undefined);
  if (ids.length) {
    await prisma.attendee.deleteMany({ where: { editionId: { in: ids } } });
    await prisma.edition.deleteMany({ where: { id: { in: ids } } });
  }
});

describe("Attendee retention (RG-ARR-66)", () => {
  it("should delete the attendees 18 months after the event, and only then", async () => {
    const report = await purgeExpiredAttendees(NOW);

    expect(report).toEqual([{ year: 1652, purged: 1 }]);
    expect(await prisma.attendee.count({ where: { editionId: expiredId } })).toBe(0);
    expect(await prisma.attendee.count({ where: { editionId: recentId } })).toBe(1);
    expect(await prisma.attendee.count({ where: { editionId: undatedId } })).toBe(1);
  });

  it("should purge an edition once, and refuse to import its attendees again", async () => {
    await purgeExpiredAttendees(NOW);
    const again = await purgeExpiredAttendees(NOW);
    const app = Fastify({ logger: false });
    await app.register(adminAttendeeRoutes, { prefix: "/api/admin" });

    const res = await app.inject({ method: "POST", url: `/api/admin/attendees/import/${expiredId}` });
    const summary = await app.inject({ method: "GET", url: `/api/admin/attendees/summary/${expiredId}` });
    await app.close();

    expect(again).toEqual([]);
    expect([res.statusCode, res.json().error]).toEqual([409, "attendees_purged"]);
    expect(summary.json().purgedAt).toBe(NOW.toISOString());
  });
});
