process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import adminTalkRoutes from "../routes/admin/talks.js";
import { prisma } from "../lib/prisma.js";

// #573 — the back-office talk list asks the API for one page, filtered and
// sorted, like the speakers' (#572).

// A year no other file uses (#292), and a title prefix only these fixtures carry.
const YEAR = 1976;
const P = "Zq573";
const VENUE = "Centre de test #573";

let app: FastifyInstance;
let editionId: number;
let roomId: number;
let speakerId: number;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(adminTalkRoutes, { prefix: "/api/admin" });

  const venue = await prisma.venue.create({ data: { name: VENUE, rooms: { create: [{ name: "Amphi", sortOrder: 0 }] } }, include: { rooms: true } });
  roomId = venue.rooms[0].id;
  editionId = (await prisma.edition.create({ data: { year: YEAR, venueId: venue.id, status: "SEE_YOU_NEXT_YEAR" } })).id;
  speakerId = (await prisma.speaker.create({ data: { slug: `${P.toLowerCase()}-ada-${Date.now()}`, name: `${P} Ada` } })).id;

  const talk = (key: string, data: Record<string, unknown>) =>
    prisma.talk.create({
      data: { editionId, slug: `${P.toLowerCase()}-${key}-${Date.now()}`, title: `${P} ${key}`, description: "", format: "CONFERENCE", language: "fr", ...data },
    });
  // Published, scheduled, with a speaker and a replay.
  await talk("Alpha", {
    publicationStatus: "PUBLISHED",
    startsAt: new Date(`${YEAR}-11-19T09:00:00Z`),
    endsAt: new Date(`${YEAR}-11-19T09:45:00Z`),
    roomId,
    roomLabel: "Amphi",
    videoUrl: "https://youtu.be/x",
    speakers: { connect: [{ id: speakerId }] },
  });
  // Draft, a time but no room, no speaker.
  await talk("Bravo", { startsAt: new Date(`${YEAR}-11-19T08:00:00Z`), format: "QUICKIE" });
  // Draft, nothing scheduled, editable by its speaker.
  await talk("Charlie", { isSpeakerEditable: true, format: "WORKSHOP" });
});

afterAll(async () => {
  await prisma.talk.deleteMany({ where: { editionId } });
  await prisma.speaker.deleteMany({ where: { id: speakerId } });
  await prisma.edition.delete({ where: { id: editionId } });
  await prisma.venue.delete({ where: { name: VENUE } });
  await app.close();
});

async function list(query: Record<string, string>) {
  const params = new URLSearchParams({ search: P, editionId: String(editionId), page: "1", ...query });
  return app.inject({ method: "GET", url: `/api/admin/talks?${params}` });
}

const titles = (body: { items: { title: string }[] }) => body.items.map((t) => t.title.replace(`${P} `, ""));

describe("Admin talks list (#573)", () => {
  it("should page the list and say how many talks match", async () => {
    const first = (await list({ limit: "2" })).json();

    expect(first).toMatchObject({ page: 1, limit: 2, total: 3 });
    expect(titles(first)).toEqual(["Alpha", "Bravo"]);
  });

  it("should keep the full array when no page is asked for", async () => {
    const res = await app.inject({ method: "GET", url: `/api/admin/talks?editionId=${editionId}&search=${P}` });

    expect(Array.isArray(res.json())).toBe(true);
    expect(res.json()).toHaveLength(3);
  });

  it("should find the sessions not yet placed in the grid", async () => {
    expect(titles((await list({ scheduled: "no" })).json())).toEqual(["Bravo", "Charlie"]);
    expect(titles((await list({ scheduled: "yes" })).json())).toEqual(["Alpha"]);
  });

  it("should filter on status, format, room and speaker-editable", async () => {
    expect(titles((await list({ status: "DRAFT" })).json())).toEqual(["Bravo", "Charlie"]);
    expect(titles((await list({ format: "QUICKIE" })).json())).toEqual(["Bravo"]);
    expect(titles((await list({ roomId: String(roomId) })).json())).toEqual(["Alpha"]);
    expect(titles((await list({ speakerEditable: "yes" })).json())).toEqual(["Charlie"]);
  });

  it("should find the sessions without a speaker and those still waiting for their replay", async () => {
    expect(titles((await list({ speakers: "none" })).json())).toEqual(["Bravo", "Charlie"]);
    expect(titles((await list({ video: "without" })).json())).toEqual(["Bravo", "Charlie"]);
  });

  it("should find a session by its speaker's name", async () => {
    const res = await app.inject({ method: "GET", url: `/api/admin/talks?page=1&editionId=${editionId}&search=${encodeURIComponent(`${P} Ada`)}` });

    expect(titles(res.json())).toEqual(["Alpha"]);
  });

  it("should sort by time with the unscheduled sessions last, whichever the direction", async () => {
    expect(titles((await list({ sort: "startsAt", order: "asc" })).json())).toEqual(["Bravo", "Alpha", "Charlie"]);
    expect(titles((await list({ sort: "startsAt", order: "desc" })).json())).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("should refuse a room filter without an edition", async () => {
    const res = await app.inject({ method: "GET", url: `/api/admin/talks?page=1&roomId=${roomId}` });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("edition_required");
  });
});
