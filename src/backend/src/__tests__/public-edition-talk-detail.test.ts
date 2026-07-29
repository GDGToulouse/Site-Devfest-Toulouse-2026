import { describe, it, expect, afterEach } from "vitest";
import Fastify from "fastify";

import editionRoutes from "../routes/editions.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// #343 — detail of a past talk, scoped by year. `/api/talks/:slug` answers 404
// for anything outside the featured edition, so the Hall of replays had nowhere
// to link. These lock the scoping, the 404 paths and the trash rules.
async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(editionRoutes, { prefix: "/api" });
  return app;
}

const talkIds: number[] = [];
const speakerIds: number[] = [];

afterEach(async () => {
  if (talkIds.length) {
    await prisma.talk.deleteMany({ where: { id: { in: talkIds } } });
    talkIds.length = 0;
  }
  if (speakerIds.length) {
    await prisma.speaker.deleteMany({ where: { id: { in: speakerIds } } });
    speakerIds.length = 0;
  }
});

const uniq = () => `${Date.now()}-${Math.round(performance.now() * 1000)}`;

async function makeTalk(editionId: number, overrides: Record<string, unknown> = {}) {
  const talk = await prisma.talk.create({
    data: {
      title: "Detail Test Talk",
      description: "Un résumé complet.",
      format: "CONFERENCE",
      level: "INTERMEDIAIRE",
      language: "en",
      publicationStatus: "PUBLISHED",
      videoUrl: "https://www.youtube.com/watch?v=detail",
      editionId,
      slug: `detail-test-${uniq()}`,
      ...overrides,
    },
  });
  talkIds.push(talk.id);
  return talk;
}

describe("GET /api/editions/:year/talks/:slug", () => {
  it("should return the talk detail for a past edition", async () => {
    const edition = await getSeededEdition();
    const talk = await makeTalk(edition.id);
    const app = await buildApp();

    const res = await app.inject({ url: `/api/editions/${edition.year}/talks/${talk.slug}` });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.slug).toBe(talk.slug);
    expect(body.description).toBe("Un résumé complet.");
    expect(body.level).toBe("INTERMEDIAIRE");
    expect(body.language).toBe("en");
    expect(body.year).toBe(edition.year);
    await app.close();
  });

  it("should attach the published speakers", async () => {
    const edition = await getSeededEdition();
    const speaker = await prisma.speaker.create({
      data: {
        name: "Detail Speaker",
        slug: `detail-speaker-${uniq()}`,
        editions: { create: [{ editionId: edition.id, publicationStatus: "PUBLISHED" }] },
      },
    });
    speakerIds.push(speaker.id);
    const talk = await makeTalk(edition.id, { speakers: { connect: { id: speaker.id } } });
    const app = await buildApp();

    const res = await app.inject({ url: `/api/editions/${edition.year}/talks/${talk.slug}` });

    expect(res.json().speakers).toEqual([
      { slug: speaker.slug, name: "Detail Speaker", photoUrl: null, company: null },
    ]);
    await app.close();
  });

  it("should return 404 for a slug that belongs to another edition", async () => {
    const edition = await getSeededEdition();
    const talk = await makeTalk(edition.id);
    // Stay inside the seeded range: a bare `year: { not: … }` could land on an
    // edition another test file created and is about to delete (#292).
    const other = await prisma.edition.findFirst({
      where: { year: { gte: 2016, lt: edition.year } },
      orderBy: { year: "desc" },
      select: { year: true },
    });
    const app = await buildApp();

    const res = await app.inject({ url: `/api/editions/${other!.year}/talks/${talk.slug}` });

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("should return 400 when the year is not a number", async () => {
    const app = await buildApp();
    const res = await app.inject({ url: "/api/editions/abcd/talks/whatever" });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("should return 404 for an unknown slug", async () => {
    const edition = await getSeededEdition();
    const app = await buildApp();
    const res = await app.inject({ url: `/api/editions/${edition.year}/talks/nope-${uniq()}` });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("should never expose a draft talk", async () => {
    const edition = await getSeededEdition();
    const talk = await makeTalk(edition.id, { publicationStatus: "DRAFT" });
    const app = await buildApp();

    const res = await app.inject({ url: `/api/editions/${edition.year}/talks/${talk.slug}` });

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("should never expose a trashed talk", async () => {
    const edition = await getSeededEdition();
    const talk = await makeTalk(edition.id, { deletedAt: new Date() });
    const app = await buildApp();

    const res = await app.inject({ url: `/api/editions/${edition.year}/talks/${talk.slug}` });

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  // A talk with no recording is still a talk: 2016 has no video at all, and its
  // pages must stay reachable.
  it("should serve a talk without a video", async () => {
    const edition = await getSeededEdition();
    const talk = await makeTalk(edition.id, { videoUrl: null });
    const app = await buildApp();

    const res = await app.inject({ url: `/api/editions/${edition.year}/talks/${talk.slug}` });

    expect(res.statusCode).toBe(200);
    expect(res.json().videoUrl).toBeNull();
    await app.close();
  });
});
