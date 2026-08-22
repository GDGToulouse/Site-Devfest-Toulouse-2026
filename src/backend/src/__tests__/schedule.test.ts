import { describe, it, expect, beforeEach, afterEach } from "vitest";

import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import adminVenueRoutes from "../routes/admin/venues.js";
import adminTalkRoutes from "../routes/admin/talks.js";
import editionRoutes from "../routes/editions.js";
import { prisma } from "../lib/prisma.js";

// Rooms and scheduling (#105).
//
// The fixture builds its own venue, edition and talk rather than borrowing the
// seed: these tests rename and delete rooms, and doing that to a shared row is
// how #292 turned into forty flaky failures.

const TEST_YEAR = 1991;

let venueId: number;
let editionId: number;
let roomId: number;
let talkId: number;

async function buildApp(routes: (app: FastifyInstance) => Promise<void>) {
  const app = Fastify({ logger: false });
  await app.register(routes, { prefix: "/api/admin" });
  return app;
}

beforeEach(async () => {
  const venue = await prisma.venue.create({ data: { name: `Lieu de test ${TEST_YEAR}` } });
  venueId = venue.id;

  const edition = await prisma.edition.create({
    data: { year: TEST_YEAR, status: "PREPARATION", venueId },
  });
  editionId = edition.id;

  const room = await prisma.room.create({
    data: { venueId, name: "Amphithéâtre", capacity: 500, sortOrder: 1 },
  });
  roomId = room.id;

  const talk = await prisma.talk.create({
    data: {
      editionId,
      slug: "session-de-test",
      title: "Session de test",
      description: "",
      format: "CONFERENCE",
      language: "fr",
      publicationStatus: "PUBLISHED",
    },
  });
  talkId = talk.id;
});

afterEach(async () => {
  await prisma.talkSimulcast.deleteMany({ where: { talk: { editionId } } });
  await prisma.talk.deleteMany({ where: { editionId } });
  await prisma.scheduleEntry.deleteMany({ where: { editionId } });
  await prisma.edition.deleteMany({ where: { id: editionId } });
  await prisma.room.deleteMany({ where: { venueId } });
  await prisma.venue.deleteMany({ where: { id: venueId } });
});

describe("scheduling a talk (#105)", () => {
  it("assigns a room and freezes its label", async () => {
    const app = await buildApp(adminTalkRoutes);

    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/talks/${talkId}`,
      payload: { roomId, startsAt: "2026-11-19T09:00:00.000Z", endsAt: "2026-11-19T09:40:00.000Z" },
    });
    expect(res.statusCode).toBe(200);

    const stored = await prisma.talk.findUnique({ where: { id: talkId } });
    expect(stored?.roomId).toBe(roomId);
    expect(stored?.roomLabel).toBe("Amphithéâtre");
    expect(stored?.startsAt?.toISOString()).toBe("2026-11-19T09:00:00.000Z");

    await app.close();
  });

  it("keeps the label a talk was scheduled under when the room is renamed (#375)", async () => {
    const talkApp = await buildApp(adminTalkRoutes);
    await talkApp.inject({
      method: "PUT",
      url: `/api/admin/talks/${talkId}`,
      payload: { roomId, startsAt: "2026-11-19T09:00:00.000Z" },
    });
    await talkApp.close();

    const venueApp = await buildApp(adminVenueRoutes);
    const renamed = await venueApp.inject({
      method: "PUT",
      url: `/api/admin/rooms/${roomId}`,
      payload: { name: "Grand Amphi" },
    });
    expect(renamed.statusCode).toBe(200);
    await venueApp.close();

    // The room now reads "Grand Amphi", but what 1991 printed is unchanged.
    const stored = await prisma.talk.findUnique({ where: { id: talkId } });
    expect(stored?.roomLabel).toBe("Amphithéâtre");
  });

  it("refuses a room that belongs to another venue", async () => {
    const otherVenue = await prisma.venue.create({ data: { name: `Autre lieu ${TEST_YEAR}` } });
    const otherRoom = await prisma.room.create({ data: { venueId: otherVenue.id, name: "Salle voisine" } });

    try {
      const app = await buildApp(adminTalkRoutes);
      const res = await app.inject({
        method: "PUT",
        url: `/api/admin/talks/${talkId}`,
        payload: { roomId: otherRoom.id },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().error).toBe("invalid_room");

      const stored = await prisma.talk.findUnique({ where: { id: talkId } });
      expect(stored?.roomId).toBeNull();
      await app.close();
    } finally {
      await prisma.room.delete({ where: { id: otherRoom.id } });
      await prisma.venue.delete({ where: { id: otherVenue.id } });
    }
  });

  it("leaves an unscheduled talk valid — the 244 imported ones have no room", async () => {
    const stored = await prisma.talk.findUnique({ where: { id: talkId } });
    expect(stored?.roomId).toBeNull();
    expect(stored?.roomLabel).toBeNull();
    expect(stored?.startsAt).toBeNull();
  });
});

describe("deleting a room (#105)", () => {
  it("refuses while a talk is scheduled in it", async () => {
    await prisma.talk.update({ where: { id: talkId }, data: { roomId, roomLabel: "Amphithéâtre" } });

    const app = await buildApp(adminVenueRoutes);
    const res = await app.inject({ method: "DELETE", url: `/api/admin/rooms/${roomId}` });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("room_in_use");

    expect(await prisma.room.findUnique({ where: { id: roomId } })).not.toBeNull();
    await app.close();
  });

  it("goes through once nothing is scheduled in it", async () => {
    const app = await buildApp(adminVenueRoutes);
    const res = await app.inject({ method: "DELETE", url: `/api/admin/rooms/${roomId}` });
    expect(res.statusCode).toBe(204);
    expect(await prisma.room.findUnique({ where: { id: roomId } })).toBeNull();
    await app.close();
  });
});

describe("GET /editions/:year/schedule", () => {
  it("returns the scheduled talks, the surrounding entries and the used rooms", async () => {
    await prisma.talk.update({
      where: { id: talkId },
      data: {
        roomId,
        roomLabel: "Amphithéâtre",
        startsAt: new Date("2026-11-19T09:00:00.000Z"),
        endsAt: new Date("2026-11-19T09:40:00.000Z"),
      },
    });
    await prisma.scheduleEntry.create({
      data: {
        editionId,
        kind: "MEAL",
        labelFr: "Déjeuner",
        labelEn: "Lunch",
        startsAt: new Date("2026-11-19T11:45:00.000Z"),
        endsAt: new Date("2026-11-19T13:15:00.000Z"),
      },
    });

    const app = Fastify({ logger: false });
    await app.register(editionRoutes, { prefix: "/api" });

    const res = await app.inject({ method: "GET", url: `/api/editions/${TEST_YEAR}/schedule` });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.talks).toHaveLength(1);
    expect(body.talks[0].room).toBe("Amphithéâtre");
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].labelFr).toBe("Déjeuner");
    // A break spans the grid, so it carries no room.
    expect(body.entries[0].roomId).toBeNull();

    // Only the rooms actually used — the venue could hold eight and the grid
    // still shows one.
    expect(body.rooms).toHaveLength(1);
    expect(body.rooms[0].name).toBe("Amphithéâtre");

    await app.close();
  });

  it("leaves unscheduled talks out of the grid", async () => {
    const app = Fastify({ logger: false });
    await app.register(editionRoutes, { prefix: "/api" });

    const res = await app.inject({ method: "GET", url: `/api/editions/${TEST_YEAR}/schedule` });
    expect(res.json().talks).toHaveLength(0);
    expect(res.json().rooms).toHaveLength(0);

    await app.close();
  });
});

// Keynotes are talks relayed to other rooms (#456). #105 had ruled the opposite
// — one room per session, a relayed keynote declared as an off-session entry —
// and that held until the grid was finished: as a band, a keynote had no detail
// page, no favourite, no calendar export, and weighed as much as a coffee break.

describe("relaying a talk to other rooms (#456)", () => {
  it("stores the relay rooms and freezes their labels", async () => {
    const app = await buildApp(adminTalkRoutes);
    const agora = await prisma.room.create({
      data: { venueId, name: "Agora 1", capacity: 500, sortOrder: 2 },
    });

    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/talks/${talkId}`,
      payload: { roomId, simulcastRoomIds: [agora.id], startsAt: "2026-11-19T09:00:00.000Z" },
    });
    expect(res.statusCode).toBe(200);

    const stored = await prisma.talkSimulcast.findMany({ where: { talkId } });
    expect(stored).toHaveLength(1);
    expect(stored[0].roomId).toBe(agora.id);
    expect(stored[0].roomLabel).toBe("Agora 1");

    await app.close();
  });

  it("keeps saying what the signage said when the room is renamed (#375)", async () => {
    const app = await buildApp(adminTalkRoutes);
    const agora = await prisma.room.create({ data: { venueId, name: "Agora 1", sortOrder: 2 } });

    await app.inject({
      method: "PUT",
      url: `/api/admin/talks/${talkId}`,
      payload: { roomId, simulcastRoomIds: [agora.id], startsAt: "2026-11-19T09:00:00.000Z" },
    });
    await prisma.room.update({ where: { id: agora.id }, data: { name: "Agora Principale" } });

    const stored = await prisma.talkSimulcast.findMany({ where: { talkId } });
    expect(stored[0].roomLabel).toBe("Agora 1");

    await app.close();
  });

  it("refuses a relay room from another venue", async () => {
    const app = await buildApp(adminTalkRoutes);
    const elsewhere = await prisma.venue.create({ data: { name: `Ailleurs ${TEST_YEAR}` } });
    const foreign = await prisma.room.create({ data: { venueId: elsewhere.id, name: "Salle X" } });

    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/talks/${talkId}`,
      payload: { roomId, simulcastRoomIds: [foreign.id] },
    });
    expect(res.statusCode).toBe(422);

    await prisma.room.deleteMany({ where: { venueId: elsewhere.id } });
    await prisma.venue.deleteMany({ where: { id: elsewhere.id } });
    await app.close();
  });

  it("drops the main room from the relays rather than drawing the talk twice", async () => {
    const app = await buildApp(adminTalkRoutes);

    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/talks/${talkId}`,
      payload: { roomId, simulcastRoomIds: [roomId] },
    });
    expect(res.statusCode).toBe(200);
    expect(await prisma.talkSimulcast.count({ where: { talkId } })).toBe(0);

    await app.close();
  });

  it("replaces the whole list, so an empty array clears the relays", async () => {
    const app = await buildApp(adminTalkRoutes);
    const agora = await prisma.room.create({ data: { venueId, name: "Agora 1", sortOrder: 2 } });

    await app.inject({
      method: "PUT",
      url: `/api/admin/talks/${talkId}`,
      payload: { roomId, simulcastRoomIds: [agora.id] },
    });
    await app.inject({
      method: "PUT",
      url: `/api/admin/talks/${talkId}`,
      payload: { simulcastRoomIds: [] },
    });

    expect(await prisma.talkSimulcast.count({ where: { talkId } })).toBe(0);
    await app.close();
  });

  it("gives a relay room its own column, even with nothing else in it", async () => {
    // The grid derives its columns from the talks actually scheduled. A room
    // whose only occupation of the day is showing the keynote on a screen would
    // otherwise have no column, and the keynote would land nowhere.
    const agora = await prisma.room.create({ data: { venueId, name: "Agora 1", sortOrder: 2 } });
    await prisma.talk.update({
      where: { id: talkId },
      data: {
        roomId,
        roomLabel: "Amphithéâtre",
        format: "KEYNOTE",
        startsAt: new Date("2026-11-19T09:00:00.000Z"),
        endsAt: new Date("2026-11-19T09:45:00.000Z"),
        simulcasts: { create: [{ roomId: agora.id, roomLabel: "Agora 1" }] },
      },
    });

    const app = Fastify({ logger: false });
    await app.register(editionRoutes, { prefix: "/api" });
    const body = (await app.inject({ method: "GET", url: `/api/editions/${TEST_YEAR}/schedule` })).json();

    expect(body.rooms.map((r: { name: string }) => r.name)).toEqual(["Amphithéâtre", "Agora 1"]);
    expect(body.talks[0].simulcasts).toEqual([{ roomId: agora.id, room: "Agora 1" }]);

    await app.close();
  });
});
