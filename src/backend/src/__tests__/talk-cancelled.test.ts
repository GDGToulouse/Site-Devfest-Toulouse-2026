process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import editionRoutes, { findEditionTalkPage } from "../routes/editions.js";
import speakerRoutes, { findSpeakerPage } from "../routes/speakers.js";
import calendarRoutes from "../routes/calendar.js";
import replayRoutes from "../routes/replays.js";
import adminTalkRoutes from "../routes/admin/talks.js";
import adminSpeakerRoutes from "../routes/admin/speakers.js";
import { importSessionize } from "../lib/sessionize-import.js";
import { prisma } from "../lib/prisma.js";

// #726 — a cancelled talk is not a draft: it will not take place. Hidden from
// the site like a draft, kept apart in the admin, out of the room clash check,
// and left alone by a Sessionize re-import. Same for a speaker's withdrawn
// participation, which hides that year only.

// Years no other file uses (#681): the edition under test, a returning
// speaker's earlier edition, and the edition the Sessionize import rewrites.
const YEAR = 1726;
const PAST_YEAR = 1727;
const IMPORT_YEAR = 1728;
const P = "zq726";

let app: FastifyInstance;
const editionIds: number[] = [];
const speakerIds: number[] = [];
let venueId: number;
let roomId: number;
let edition: { id: number; year: number };

let kept: { id: number; slug: string };
let cancelled: { id: number; slug: string };
let draft: { id: number; slug: string };
let newcomer: { id: number; slug: string };
let veteran: { id: number; slug: string };
let host: { id: number; slug: string };

const at = (year: number, time: string) => new Date(`${year}-11-19T${time}:00Z`);

async function makeSpeaker(name: string) {
  const speaker = await prisma.speaker.create({ data: { slug: `${P}-${name}-${Date.now()}`, name: `${P} ${name}` } });
  speakerIds.push(speaker.id);
  return speaker;
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(editionRoutes, { prefix: "/api" });
  await app.register(speakerRoutes, { prefix: "/api" });
  await app.register(calendarRoutes, { prefix: "/api" });
  await app.register(replayRoutes, { prefix: "/api" });
  await app.register(adminTalkRoutes, { prefix: "/api/admin" });
  await app.register(adminSpeakerRoutes, { prefix: "/api/admin" });

  const venue = await prisma.venue.create({
    data: { name: `Lieu de test #726 ${Date.now()}`, rooms: { create: [{ name: "Amphi", sortOrder: 0 }] } },
    include: { rooms: true },
  });
  venueId = venue.id;
  roomId = venue.rooms[0].id;

  edition = await prisma.edition.create({ data: { year: YEAR, venueId, status: "SEE_YOU_NEXT_YEAR" } });
  const past = await prisma.edition.create({ data: { year: PAST_YEAR, status: "SEE_YOU_NEXT_YEAR" } });
  editionIds.push(edition.id, past.id);

  host = await makeSpeaker("host");
  newcomer = await makeSpeaker("newcomer");
  veteran = await makeSpeaker("veteran");
  await prisma.speakerEdition.createMany({
    data: [
      { speakerId: host.id, editionId: edition.id, publicationStatus: "PUBLISHED" },
      // First participation, withdrawn: the person has nothing left to show.
      { speakerId: newcomer.id, editionId: edition.id, publicationStatus: "WITHDRAWN" },
      // A returning speaker withdrawn this year, published the year before.
      { speakerId: veteran.id, editionId: edition.id, publicationStatus: "WITHDRAWN" },
      { speakerId: veteran.id, editionId: past.id, publicationStatus: "PUBLISHED" },
    ],
  });

  const talk = (key: string, data: Record<string, unknown>) =>
    prisma.talk.create({
      data: {
        editionId: edition.id,
        slug: `${P}-${key}-${Date.now()}`,
        title: `${P} ${key}`,
        description: "",
        format: "CONFERENCE",
        language: "fr",
        ...data,
      },
      select: { id: true, slug: true },
    });
  const slot = { startsAt: at(YEAR, "09:00"), endsAt: at(YEAR, "09:45"), roomId, roomLabel: "Amphi" };
  // The replacement, in the slot the cancelled talk keeps.
  kept = await talk("kept", { ...slot, publicationStatus: "PUBLISHED", speakers: { connect: [{ id: host.id }] } });
  cancelled = await talk("cancelled", {
    ...slot,
    publicationStatus: "CANCELLED",
    videoUrl: "https://youtu.be/zq726",
    speakers: { connect: [{ id: newcomer.id }, { id: veteran.id }] },
  });
  draft = await talk("draft", {});
  await prisma.talk.create({
    data: {
      editionId: past.id,
      slug: `${P}-past-${Date.now()}`,
      title: `${P} past`,
      description: "",
      format: "CONFERENCE",
      language: "fr",
      publicationStatus: "PUBLISHED",
      speakers: { connect: [{ id: veteran.id }] },
    },
  });
});

afterAll(async () => {
  if (editionIds.length > 0) {
    await prisma.talk.deleteMany({ where: { editionId: { in: editionIds } } });
    await prisma.edition.deleteMany({ where: { id: { in: editionIds } } });
  }
  if (speakerIds.length > 0) await prisma.speaker.deleteMany({ where: { id: { in: speakerIds } } });
  if (venueId !== undefined) await prisma.venue.delete({ where: { id: venueId } });
});

describe("a cancelled talk on the public site (#726)", () => {
  it("should leave it out of the edition's talks", async () => {
    const res = await app.inject({ url: `/api/editions/${YEAR}/talks` });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain(kept.slug);
    expect(res.body).not.toContain(cancelled.slug);
  });

  it("should leave it out of the schedule", async () => {
    const res = await app.inject({ url: `/api/editions/${YEAR}/schedule` });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain(kept.slug);
    expect(res.body).not.toContain(cancelled.slug);
  });

  it("should answer 404 on its page", async () => {
    const res = await app.inject({ url: `/api/editions/${YEAR}/talks/${cancelled.slug}` });

    expect(res.statusCode).toBe(404);
  });

  it("should leave it out of the calendar export", async () => {
    const res = await app.inject({ url: `/api/editions/${YEAR}/schedule.ics?talks=${kept.slug},${cancelled.slug}` });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain(`${P} kept`);
    expect(res.body).not.toContain(`${P} cancelled`);
  });

  it("should leave it out of the replays", async () => {
    const res = await app.inject({ url: `/api/replays?year=${YEAR}` });

    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain(cancelled.slug);
  });

  it("should keep it out of the team's preview, since it will never be published", async () => {
    expect(await findEditionTalkPage(edition, cancelled.slug, { includeDrafts: true })).toBeNull();
    expect(await findEditionTalkPage(edition, draft.slug, { includeDrafts: true })).not.toBeNull();
  });
});

describe("a withdrawn participation on the public site (#726)", () => {
  it("should leave both speakers out of the edition's speakers", async () => {
    const res = await app.inject({ url: `/api/editions/${YEAR}/speakers` });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain(host.slug);
    expect(res.body).not.toContain(newcomer.slug);
    expect(res.body).not.toContain(veteran.slug);
  });

  it("should answer 404 on the page of a speaker whose first participation is withdrawn", async () => {
    const res = await app.inject({ url: `/api/speakers/${newcomer.slug}` });

    expect(res.statusCode).toBe(404);
  });

  it("should keep a returning speaker's page with their past editions only", async () => {
    const res = await app.inject({ url: `/api/speakers/${veteran.slug}` });

    expect(res.statusCode).toBe(200);
    const years = (res.json() as { participations: { year: number }[] }).participations.map((p) => p.year);
    expect(years).toEqual([PAST_YEAR]);
  });

  it("should keep the withdrawn year out of the team's preview", async () => {
    const page = await findSpeakerPage(veteran.slug, { includeDrafts: true });

    expect(page?.participations.map((p) => p.year)).toEqual([PAST_YEAR]);
    expect(await findSpeakerPage(newcomer.slug, { includeDrafts: true })).toBeNull();
  });
});

describe("a cancelled talk in the admin (#726)", () => {
  it("should list it under its own status filter", async () => {
    const res = await app.inject({ url: `/api/admin/talks?editionId=${edition.id}&status=CANCELLED` });

    expect(res.statusCode).toBe(200);
    expect((res.json() as { slug: string }[]).map((t) => t.slug)).toEqual([cancelled.slug]);
  });

  it("should not republish a cancelled talk caught in a bulk publish", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/talks/bulk",
      payload: { ids: [cancelled.id, draft.id], action: "setStatus", value: "PUBLISHED" },
    });

    expect(res.statusCode).toBe(200);
    expect((await prisma.talk.findUniqueOrThrow({ where: { id: cancelled.id } })).publicationStatus).toBe("CANCELLED");
    expect((await prisma.talk.findUniqueOrThrow({ where: { id: draft.id } })).publicationStatus).toBe("PUBLISHED");
    await prisma.talk.update({ where: { id: draft.id }, data: { publicationStatus: "DRAFT" } });
  });

  it("should refuse a status that does not exist", async () => {
    const res = await app.inject({ method: "PUT", url: `/api/admin/talks/${draft.id}`, payload: { publicationStatus: "WITHDRAWN" } });

    expect(res.statusCode).toBe(400);
  });

  it("should put a restored talk back in its slot and room", async () => {
    const other = await prisma.talk.create({
      data: {
        editionId: edition.id,
        slug: `${P}-restored-${Date.now()}`,
        title: `${P} restored`,
        description: "",
        format: "CONFERENCE",
        language: "fr",
        publicationStatus: "PUBLISHED",
        startsAt: at(YEAR, "14:00"),
        endsAt: at(YEAR, "14:45"),
        roomId,
        roomLabel: "Amphi",
      },
    });

    const cancel = await app.inject({ method: "PUT", url: `/api/admin/talks/${other.id}`, payload: { publicationStatus: "CANCELLED" } });
    expect(cancel.statusCode).toBe(200);
    expect((await app.inject({ url: `/api/editions/${YEAR}/talks/${other.slug}` })).statusCode).toBe(404);

    const restore = await app.inject({ method: "PUT", url: `/api/admin/talks/${other.id}`, payload: { publicationStatus: "PUBLISHED" } });
    expect(restore.statusCode).toBe(200);
    const after = await prisma.talk.findUniqueOrThrow({ where: { id: other.id } });
    expect(after).toMatchObject({ publicationStatus: "PUBLISHED", roomId, roomLabel: "Amphi" });
    expect(after.startsAt?.toISOString()).toBe(at(YEAR, "14:00").toISOString());
    expect((await app.inject({ url: `/api/editions/${YEAR}/talks/${other.slug}` })).statusCode).toBe(200);
  });
});

describe("a withdrawn participation in the admin (#726)", () => {
  it("should list it under its own status filter", async () => {
    const res = await app.inject({ url: `/api/admin/speakers?editionId=${edition.id}&status=WITHDRAWN&search=${P}` });

    expect(res.statusCode).toBe(200);
    const slugs = (res.json() as { slug: string }[]).map((s) => s.slug).sort();
    expect(slugs).toEqual([newcomer.slug, veteran.slug].sort());
  });

  it("should store a withdrawal and a return made from the speaker's sheet", async () => {
    const withdraw = await app.inject({
      method: "PUT",
      url: `/api/admin/speakers/${host.id}`,
      payload: { editionId: edition.id, publicationStatus: "WITHDRAWN" },
    });
    expect(withdraw.statusCode).toBe(200);
    const stored = () => prisma.speakerEdition.findFirstOrThrow({ where: { speakerId: host.id, editionId: edition.id } });
    expect((await stored()).publicationStatus).toBe("WITHDRAWN");

    await app.inject({
      method: "PUT",
      url: `/api/admin/speakers/${host.id}`,
      payload: { editionId: edition.id, publicationStatus: "PUBLISHED" },
    });
    expect((await stored()).publicationStatus).toBe("PUBLISHED");
  });

  it("should not republish a withdrawn participation caught in a bulk publish", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/speakers/bulk",
      payload: { ids: [newcomer.id], editionId: edition.id, action: "setStatus", value: "PUBLISHED" },
    });

    expect(res.statusCode).toBe(200);
    const participation = await prisma.speakerEdition.findFirstOrThrow({ where: { speakerId: newcomer.id, editionId: edition.id } });
    expect(participation.publicationStatus).toBe("WITHDRAWN");
  });
});

describe("a cancelled talk in the Sessionize import (#726)", () => {
  let importEditionId: number;
  let cancelledId: number;
  let withdrawnSpeakerId: number;

  beforeAll(async () => {
    const importEdition = await prisma.edition.create({ data: { year: IMPORT_YEAR, venueId } });
    importEditionId = importEdition.id;
    editionIds.push(importEditionId);

    // Sessionize speakers are matched on the slug of their name.
    const speaker = await prisma.speaker.create({ data: { slug: "zq726-retire-1728", name: "Zq726 Retiré 1728" } });
    speakerIds.push(speaker.id);
    withdrawnSpeakerId = speaker.id;
    await prisma.speakerEdition.create({ data: { speakerId: speaker.id, editionId: importEditionId, publicationStatus: "WITHDRAWN" } });
    const slot = { startsAt: at(IMPORT_YEAR, "09:00"), endsAt: at(IMPORT_YEAR, "09:45"), roomId, roomLabel: "Amphi" };
    const base = { editionId: importEditionId, description: "", format: "CONFERENCE" as const, language: "fr" };
    cancelledId = (await prisma.talk.create({
      data: { ...base, ...slot, slug: "session-annulee-1728", title: "Session annulée 1728", publicationStatus: "CANCELLED" },
    })).id;
    await prisma.talk.create({
      data: { ...base, ...slot, slug: "session-remplacante-1728", title: "Session remplaçante 1728", publicationStatus: "PUBLISHED" },
    });
  });

  it("should not report a clash with the talk that took its slot", async () => {
    const report = await importSessionize(importEditionId, { sessions: [], speakers: [], categories: [] });

    expect(report.warnings.filter((w) => w.includes("chevauchent"))).toEqual([]);
  });

  it("should tell a cancelled talk and a withdrawn speaker apart in the absent list", async () => {
    const report = await importSessionize(importEditionId, { sessions: [], speakers: [], categories: [] });

    expect(report.absent.talks.find((t) => t.id === cancelledId)?.publicationStatus).toBe("CANCELLED");
    expect(report.absent.speakers.find((s) => s.id === withdrawnSpeakerId)?.publicationStatus).toBe("WITHDRAWN");
  });

  it("should leave the status of a cancelled talk and a withdrawn speaker alone on re-import", async () => {
    await importSessionize(importEditionId, {
      sessions: [{ id: "sz-1", title: "Session annulée 1728", speakers: ["sz-sp"] }],
      speakers: [{ id: "sz-sp", fullName: "Zq726 Retiré 1728" }],
      categories: [],
    });

    expect((await prisma.talk.findUniqueOrThrow({ where: { id: cancelledId } })).publicationStatus).toBe("CANCELLED");
    const participation = await prisma.speakerEdition.findFirstOrThrow({
      where: { speakerId: withdrawnSpeakerId, editionId: importEditionId },
    });
    expect(participation.publicationStatus).toBe("WITHDRAWN");
  });
});
