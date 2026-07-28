import { describe, it, expect, afterEach } from "vitest";
import Fastify from "fastify";

import speakerRoutes from "../routes/speakers.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// #352 — a speaker page is a person's page, no longer scoped to the featured
// edition. The payload therefore carries participations (not a flat talk list):
// 19 published people have no talk at all, so "took part in 2018, no published
// session" cannot be expressed by talks alone.
async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(speakerRoutes, { prefix: "/api" });
  return app;
}

const createdSpeakerIds: number[] = [];
const createdEditionIds: number[] = [];
const uniq = () => `${Date.now()}-${Math.round(performance.now())}`;

afterEach(async () => {
  if (createdSpeakerIds.length) {
    await prisma.talk.deleteMany({ where: { speakers: { some: { id: { in: createdSpeakerIds } } } } });
    await prisma.speaker.deleteMany({ where: { id: { in: createdSpeakerIds } } });
    createdSpeakerIds.length = 0;
  }
  if (createdEditionIds.length) {
    await prisma.talk.deleteMany({ where: { editionId: { in: createdEditionIds } } });
    await prisma.edition.deleteMany({ where: { id: { in: createdEditionIds } } });
    createdEditionIds.length = 0;
  }
});

// Editions this file owns, so a trashed one never disturbs a parallel test file
// (#292). Years sit below the seeded range for the same reason.
async function makeEdition(year: number, { deletedAt = null as Date | null } = {}) {
  const edition = await prisma.edition.create({
    data: { year, status: "SEE_YOU_NEXT_YEAR", deletedAt },
  });
  createdEditionIds.push(edition.id);
  return edition;
}

async function makePerson(
  name: string,
  participations: { editionId: number; publicationStatus?: "DRAFT" | "PUBLISHED" }[],
) {
  const speaker = await prisma.speaker.create({
    data: {
      name,
      slug: `detail-${name.toLowerCase().replace(/\W+/g, "-")}-${uniq()}`,
      contactEmail: "private@example.org",
      editToken: `tok-${uniq()}`,
      editions: {
        create: participations.map((p) => ({
          editionId: p.editionId,
          publicationStatus: p.publicationStatus ?? "PUBLISHED",
        })),
      },
    },
  });
  createdSpeakerIds.push(speaker.id);
  return speaker;
}

async function makeTalk(editionId: number, speakerId: number, title: string) {
  return prisma.talk.create({
    data: {
      editionId,
      slug: `detail-talk-${uniq()}`,
      title,
      description: "",
      format: "CONFERENCE",
      language: "fr",
      publicationStatus: "PUBLISHED",
      speakers: { connect: { id: speakerId } },
    },
  });
}

describe("GET /api/speakers/:slug — the person, not the edition (#352)", () => {
  it("answers 200 for someone published only on a past edition", async () => {
    // The whole point of the issue: before #352 this route resolved the featured
    // edition first, so a 2019-only speaker had no page at all.
    const past = await makeEdition(1901);
    const person = await makePerson("Past Only", [{ editionId: past.id }]);

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/speakers/${person.slug}` });
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Past Only");
  });

  it("groups talks by edition, most recent year first", async () => {
    const older = await makeEdition(1902);
    const newer = await makeEdition(1903);
    const person = await makePerson("Two Years", [
      { editionId: older.id },
      { editionId: newer.id },
    ]);
    await makeTalk(older.id, person.id, "Session ancienne");
    await makeTalk(newer.id, person.id, "Session récente");

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/speakers/${person.slug}` });
    await app.close();

    const participations = res.json().participations;
    expect(participations.map((p: { year: number }) => p.year)).toEqual([1903, 1902]);
    expect(participations[0].talks.map((t: { title: string }) => t.title)).toEqual(["Session récente"]);
    expect(participations[1].talks.map((t: { title: string }) => t.title)).toEqual(["Session ancienne"]);
  });

  it("keeps an edition section for a participation with no talk", async () => {
    // 19 published people are in this case. A flat talk list would erase them.
    const edition = await makeEdition(1904);
    const person = await makePerson("No Session", [{ editionId: edition.id }]);

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/speakers/${person.slug}` });
    await app.close();

    expect(res.json().participations).toHaveLength(1);
    expect(res.json().participations[0]).toMatchObject({ year: 1904, talks: [] });
  });

  it("hides the talks of an edition where the participation is a draft", async () => {
    const published = await makeEdition(1905);
    const draft = await makeEdition(1906);
    const person = await makePerson("Draft Elsewhere", [
      { editionId: published.id, publicationStatus: "PUBLISHED" },
      { editionId: draft.id, publicationStatus: "DRAFT" },
    ]);
    await makeTalk(published.id, person.id, "Session visible");
    await makeTalk(draft.id, person.id, "Session cachée");

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/speakers/${person.slug}` });
    await app.close();

    // The talk is PUBLISHED but its year is not: it must not leak through, and
    // no section may be created on the fly for it.
    const participations = res.json().participations;
    expect(participations.map((p: { year: number }) => p.year)).toEqual([1905]);
    const titles = participations.flatMap((p: { talks: { title: string }[] }) => p.talks.map((t) => t.title));
    expect(titles).toContain("Session visible");
    expect(titles).not.toContain("Session cachée");
  });

  it("ignores a participation on a trashed edition", async () => {
    // The route used to go through getFeaturedEdition(), which already filtered
    // the trash. Unscoping it makes this filter our own responsibility.
    const live = await makeEdition(1907);
    const trashed = await makeEdition(1908, { deletedAt: new Date() });
    const person = await makePerson("Trashed Edition", [
      { editionId: live.id },
      { editionId: trashed.id },
    ]);

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/speakers/${person.slug}` });
    await app.close();

    expect(res.json().participations.map((p: { year: number }) => p.year)).toEqual([1907]);
  });

  it("404s when every participation is a draft", async () => {
    const edition = await makeEdition(1909);
    const person = await makePerson("All Draft", [
      { editionId: edition.id, publicationStatus: "DRAFT" },
    ]);

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/speakers/${person.slug}` });
    await app.close();

    expect(res.statusCode).toBe(404);
  });

  it("404s for a trashed person", async () => {
    const edition = await makeEdition(1910);
    const person = await makePerson("Trashed Person", [{ editionId: edition.id }]);
    await prisma.speaker.update({ where: { id: person.id }, data: { deletedAt: new Date() } });

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/speakers/${person.slug}` });
    await app.close();

    expect(res.statusCode).toBe(404);
  });

  it("never leaks the private fields", async () => {
    const edition = await makeEdition(1911);
    const person = await makePerson("Private Fields", [{ editionId: edition.id }]);

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/speakers/${person.slug}` });
    await app.close();

    const body = res.json();
    expect(body).not.toHaveProperty("contactEmail");
    expect(body).not.toHaveProperty("editToken");
  });
});
