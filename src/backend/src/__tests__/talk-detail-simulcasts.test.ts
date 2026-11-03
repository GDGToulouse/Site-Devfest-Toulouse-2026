import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import talkRoutes, { findFeaturedTalkPage } from "../routes/talks.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// The talk page says where to go (#717): its room, and the rooms a keynote is
// relayed to (#456). GET /api/talks/:slug resolves against the featured
// edition, so the fixtures are attached to the seeded one it points at.
async function buildTalkApp() {
  const app = Fastify({ logger: false });
  await app.register(talkRoutes, { prefix: "/api" });
  return app;
}

const KEYNOTE_SLUG = "simulcast-detail-keynote-717";
const PLAIN_SLUG = "simulcast-detail-plain-717";

let edition: { id: number; year: number };
const talkIds: number[] = [];

describe("GET /api/talks/:slug — simulcast rooms (#717)", () => {
  beforeAll(async () => {
    edition = await getSeededEdition();

    const keynote = await prisma.talk.create({
      data: {
        editionId: edition.id,
        slug: KEYNOTE_SLUG,
        title: "Keynote de clôture",
        description: "",
        format: "KEYNOTE",
        language: "fr",
        publicationStatus: "DRAFT",
        roomLabel: "Amphithéâtre",
        startsAt: new Date("2026-11-19T16:30:00.000Z"),
        endsAt: new Date("2026-11-19T17:15:00.000Z"),
        // No room row: the frozen label is what the page must show (#375).
        simulcasts: { create: [{ roomId: null, roomLabel: "Agora 1" }] },
      },
    });
    const plain = await prisma.talk.create({
      data: {
        editionId: edition.id,
        slug: PLAIN_SLUG,
        title: "Conférence sans retransmission",
        description: "",
        format: "CONFERENCE",
        language: "fr",
        publicationStatus: "PUBLISHED",
      },
    });
    talkIds.push(keynote.id, plain.id);
  });

  afterAll(async () => {
    if (talkIds.length > 0) {
      await prisma.talkSimulcast.deleteMany({ where: { talkId: { in: talkIds } } });
      await prisma.talk.deleteMany({ where: { id: { in: talkIds } } });
    }
  });

  it("lists the relay rooms by their frozen label", async () => {
    await prisma.talk.update({ where: { id: talkIds[0] }, data: { publicationStatus: "PUBLISHED" } });
    const app = await buildTalkApp();
    const res = await app.inject({ method: "GET", url: `/api/talks/${KEYNOTE_SLUG}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().simulcasts).toEqual([{ roomId: null, room: "Agora 1" }]);
    await app.close();
  });

  it("answers an empty list for a talk relayed nowhere", async () => {
    const app = await buildTalkApp();
    const res = await app.inject({ method: "GET", url: `/api/talks/${PLAIN_SLUG}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().simulcasts).toEqual([]);
    await app.close();
  });

  it("gives the draft preview the same relay rooms (#618)", async () => {
    await prisma.talk.update({ where: { id: talkIds[0] }, data: { publicationStatus: "DRAFT" } });
    const page = await findFeaturedTalkPage(edition, KEYNOTE_SLUG, { includeDrafts: true });
    expect(page?.simulcasts).toEqual([{ roomId: null, room: "Agora 1" }]);
  });
});
