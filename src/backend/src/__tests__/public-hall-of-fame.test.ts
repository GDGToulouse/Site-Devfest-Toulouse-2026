import { describe, it, expect, afterEach } from "vitest";
import Fastify from "fastify";

import speakerRoutes from "../routes/speakers.js";
import { prisma } from "../lib/prisma.js";

// #352 — every person who ever spoke, all editions at once. The list is read
// through the participations, so someone who came back three years appears once
// with three badges instead of the three rows the pre-#351 model produced.
async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(speakerRoutes, { prefix: "/api" });
  return app;
}

const createdSpeakerIds: number[] = [];
const createdEditionIds: number[] = [];
const uniq = () => `${Date.now()}-${Math.round(performance.now())}`;

afterEach(async () => {
  // Participations go first, on purpose. Deleting speakers and editions as two
  // separate statements leaves a window where a SpeakerEdition still points at
  // a row that is on its way out, and /speakers/hall-of-fame reads every
  // participation in the database — including this file's. A parallel test file
  // hitting that window got an error instead of a list (#292 all over again).
  if (createdSpeakerIds.length || createdEditionIds.length) {
    await prisma.speakerEdition.deleteMany({
      where: {
        OR: [
          { speakerId: { in: createdSpeakerIds } },
          { editionId: { in: createdEditionIds } },
        ],
      },
    });
  }
  if (createdSpeakerIds.length) {
    await prisma.speaker.deleteMany({ where: { id: { in: createdSpeakerIds } } });
    createdSpeakerIds.length = 0;
  }
  if (createdEditionIds.length) {
    await prisma.edition.deleteMany({ where: { id: { in: createdEditionIds } } });
    createdEditionIds.length = 0;
  }
});

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
  { deletedAt = null as Date | null } = {},
) {
  const speaker = await prisma.speaker.create({
    data: {
      name,
      slug: `hof-${name.toLowerCase().replace(/\W+/g, "-")}-${uniq()}`,
      deletedAt,
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

async function fetchHallOfFame() {
  const app = await buildApp();
  const res = await app.inject({ method: "GET", url: "/api/speakers/hall-of-fame" });
  await app.close();
  return res;
}

describe("GET /api/speakers/hall-of-fame (#352)", () => {
  it("lists a person once, with every year they took part in", async () => {
    const older = await makeEdition(1801);
    const newer = await makeEdition(1802);
    const person = await makePerson("Hof Multi", [
      { editionId: older.id },
      { editionId: newer.id },
    ]);

    const res = await fetchHallOfFame();

    expect(res.statusCode).toBe(200);
    const rows = res.json().filter((r: { slug: string }) => r.slug === person.slug);
    expect(rows).toHaveLength(1);
    // Years newest first, so the badges read like a timeline.
    expect(rows[0].years).toEqual([1802, 1801]);
  });

  it("keeps someone whose only participation carries no talk", async () => {
    const edition = await makeEdition(1803);
    const person = await makePerson("Hof No Talk", [{ editionId: edition.id }]);

    const res = await fetchHallOfFame();

    // Asserted before reading the body: without it a failing route surfaced as
    // "res.json(...).map is not a function", which says nothing about why.
    expect(res.statusCode).toBe(200);
    const slugs = res.json().map((r: { slug: string }) => r.slug);
    expect(slugs).toContain(person.slug);
  });

  it("excludes a person whose every participation is a draft", async () => {
    const edition = await makeEdition(1804);
    const person = await makePerson("Hof Draft", [
      { editionId: edition.id, publicationStatus: "DRAFT" },
    ]);

    const res = await fetchHallOfFame();

    expect(res.json().map((r: { slug: string }) => r.slug)).not.toContain(person.slug);
  });

  it("excludes a trashed person and a participation on a trashed edition", async () => {
    const live = await makeEdition(1805);
    const trashedEdition = await makeEdition(1806, { deletedAt: new Date() });
    const ghost = await makePerson("Hof Ghost", [{ editionId: live.id }], { deletedAt: new Date() });
    const onTrashed = await makePerson("Hof On Trashed", [
      { editionId: live.id },
      { editionId: trashedEdition.id },
    ]);

    const res = await fetchHallOfFame();
    const rows = res.json();

    expect(rows.map((r: { slug: string }) => r.slug)).not.toContain(ghost.slug);
    const kept = rows.find((r: { slug: string }) => r.slug === onTrashed.slug);
    expect(kept.years).toEqual([1805]);
  });

  it("sorts people alphabetically", async () => {
    const edition = await makeEdition(1807);
    await makePerson("Zzz Hof Last", [{ editionId: edition.id }]);
    await makePerson("Aaa Hof First", [{ editionId: edition.id }]);

    const res = await fetchHallOfFame();

    const names = res.json().map((r: { name: string }) => r.name);
    // A 239-entry archive is only usable alphabetically.
    expect(names.indexOf("Aaa Hof First")).toBeLessThan(names.indexOf("Zzz Hof Last"));
  });

  it("does not expose private or bulky fields", async () => {
    const edition = await makeEdition(1808);
    const person = await makePerson("Hof Lean", [{ editionId: edition.id }]);

    const res = await fetchHallOfFame();

    const row = res.json().find((r: { slug: string }) => r.slug === person.slug);
    expect(row).not.toHaveProperty("contactEmail");
    expect(row).not.toHaveProperty("editToken");
    // 239 entries ship in one payload: no bios.
    expect(row).not.toHaveProperty("bioFr");
  });
});
