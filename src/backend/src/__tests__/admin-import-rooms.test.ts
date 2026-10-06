import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import adminImportRoutes from "../routes/admin/import.js";
import { prisma } from "../lib/prisma.js";

// The admin pairs each Sessionize room with a room of the edition's venue, once
// (#519). The guard comes from the admin group; these tests cover the routes.

// A past year, for the reason given in sessionize-import-mapping.test.ts (#292).
const TEST_YEAR = 1996;
const VENUE = "Centre de test #519 routes";
const OTHER_VENUE = "Autre centre #519 routes";
const SZ_AMPHI = 1;

let app: FastifyInstance;
let editionId: number;
let amphiId: number;
let foreignRoomId: number;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(adminImportRoutes, { prefix: "/api/admin" });
  await app.ready();

  const venue = await prisma.venue.create({
    data: { name: VENUE, rooms: { create: [{ name: "Amphithéâtre" }] } },
    include: { rooms: true },
  });
  amphiId = venue.rooms[0].id;
  const other = await prisma.venue.create({
    data: { name: OTHER_VENUE, rooms: { create: [{ name: "Ailleurs" }] } },
    include: { rooms: true },
  });
  foreignRoomId = other.rooms[0].id;
  const edition = await prisma.edition.create({
    data: {
      year: TEST_YEAR,
      venueId: venue.id,
      sessionizeRooms: { create: [{ sessionizeId: SZ_AMPHI, name: "Amphi" }] },
    },
  });
  editionId = edition.id;
});

afterAll(async () => {
  await app.close();
  await prisma.edition.delete({ where: { id: editionId } });
  await prisma.venue.deleteMany({ where: { name: { in: [VENUE, OTHER_VENUE] } } });
});

function pair(roomId: number | null, sessionizeId = SZ_AMPHI) {
  return app.inject({
    method: "PUT",
    url: `/api/admin/import/sessionize/${editionId}/rooms/${sessionizeId}`,
    payload: { roomId },
  });
}

describe("Sessionize room pairing routes (#519)", () => {
  it("should list the pairings and the venue rooms to choose from", async () => {
    const res = await app.inject({ method: "GET", url: `/api/admin/import/sessionize/${editionId}/rooms` });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      venue: { name: VENUE },
      venueRooms: [{ id: amphiId, name: "Amphithéâtre" }],
      pairings: [{ sessionizeId: SZ_AMPHI, name: "Amphi", roomId: null }],
    });
  });

  it("should pair a Sessionize room with a venue room, then unpair it", async () => {
    expect((await pair(amphiId)).json()).toMatchObject({ roomId: amphiId });
    expect((await pair(null)).json()).toMatchObject({ roomId: null });
  });

  it("should refuse a room of another venue", async () => {
    expect((await pair(foreignRoomId)).statusCode).toBe(422);
  });

  it("should answer 404 for a Sessionize room the edition never saw", async () => {
    expect((await pair(amphiId, 999)).statusCode).toBe(404);
  });
});
