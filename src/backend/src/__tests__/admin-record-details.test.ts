process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import adminSpeakerRoutes from "../routes/admin/speakers.js";
import adminSponsorRoutes from "../routes/admin/sponsors.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { createSponsorFixture, tierIdByKey } from "./sponsor-test-helpers.js";

// #484 — the read-only panel shows what a record is linked to: a speaker's
// talks and employer by name, a sponsor's speakers. All DRAFT, so no public
// count moves while other suites run.

let app: FastifyInstance;
const stamp = `${Date.now()}-${Math.round(performance.now())}`;
const created = { speakerId: 0, sponsorId: 0, talkId: 0 };

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(adminSpeakerRoutes, { prefix: "/api/admin" });
  await app.register(adminSponsorRoutes, { prefix: "/api/admin" });
  await app.ready();

  const edition = await getSeededEdition();
  const sponsor = await createSponsorFixture({
    name: `Details Co ${stamp}`,
    slug: `details-co-${stamp}`,
    editionId: edition.id,
    tierId: await tierIdByKey("gold"),
  });
  const speaker = await prisma.speaker.create({
    data: {
      name: `Details Speaker ${stamp}`,
      slug: `details-speaker-${stamp}`,
      editions: { create: [{ editionId: edition.id, sponsorId: sponsor.id }] },
    },
  });
  const talk = await prisma.talk.create({
    data: {
      title: `Details Talk ${stamp}`,
      slug: `details-talk-${stamp}`,
      format: "CONFERENCE",
      description: "",
      language: "fr",
      editionId: edition.id,
      speakers: { connect: [{ id: speaker.id }] },
    },
  });
  Object.assign(created, { speakerId: speaker.id, sponsorId: sponsor.id, talkId: talk.id });
});

afterAll(async () => {
  await app.close();
  if (created.talkId !== undefined) await prisma.talk.deleteMany({ where: { id: created.talkId } });
  if (created.speakerId !== undefined) await prisma.speaker.deleteMany({ where: { id: created.speakerId } });
  if (created.sponsorId !== undefined) await prisma.sponsor.deleteMany({ where: { id: created.sponsorId } });
});

describe("Admin record details (#484)", () => {
  it("names a speaker's employer each year and lists their talks", async () => {
    const res = await app.inject({ method: "GET", url: `/api/admin/speakers/${created.speakerId}` });

    expect(res.json().editions[0].sponsor).toEqual({ id: created.sponsorId, name: `Details Co ${stamp}` });
    expect(res.json().talks).toEqual([expect.objectContaining({ id: created.talkId, title: `Details Talk ${stamp}` })]);
  });

  it("lists the speakers who came on a sponsor's behalf", async () => {
    const res = await app.inject({ method: "GET", url: `/api/admin/sponsors/${created.sponsorId}` });

    expect(res.json().speakers).toEqual([
      expect.objectContaining({ id: created.speakerId, name: `Details Speaker ${stamp}` }),
    ]);
  });
});
