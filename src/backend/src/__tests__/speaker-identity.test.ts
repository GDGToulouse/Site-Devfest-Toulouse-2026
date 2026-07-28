import { describe, it, expect, afterEach } from "vitest";
import Fastify from "fastify";

import speakerRoutes from "../routes/speakers.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// #351 — a Speaker is a person, not a per-edition row: the slug is globally
// unique and participations carry the per-edition state. These lock the
// behaviours that only exist because of that split.
async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(speakerRoutes, { prefix: "/api" });
  return app;
}

const createdIds: number[] = [];
const createdEditionIds: number[] = [];
const uniq = () => `${Date.now()}-${Math.round(performance.now())}`;

afterEach(async () => {
  if (createdIds.length) {
    await prisma.talk.deleteMany({ where: { speakers: { some: { id: { in: createdIds } } } } });
    await prisma.speaker.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  }
  if (createdEditionIds.length) {
    await prisma.edition.deleteMany({ where: { id: { in: createdEditionIds } } });
    createdEditionIds.length = 0;
  }
});

// A past edition to pair with the featured one. Created rather than looked up:
// the seed only carries 2026 and 2025, so relying on the history being loaded
// made this pass locally and fail on a fresh CI database. The year stays far
// below every seeded one, so it can never be mistaken for "the most recent" by a
// parallel test file (#292).
async function getPastEdition() {
  const edition = await prisma.edition.create({
    data: { year: 1601 + createdEditionIds.length, status: "SEE_YOU_NEXT_YEAR" },
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
      slug: `identity-${name.toLowerCase().replace(/\W+/g, "-")}-${uniq()}`,
      editions: {
        create: participations.map((p) => ({
          editionId: p.editionId,
          publicationStatus: p.publicationStatus ?? "PUBLISHED",
        })),
      },
    },
  });
  createdIds.push(speaker.id);
  return speaker;
}

describe("Speaker identity across editions (#351)", () => {
  it("keeps one identity for a person who spoke at several editions", async () => {
    const current = await getSeededEdition();
    const past = await getPastEdition();

    const person = await makePerson("Multi Edition", [
      { editionId: current.id },
      { editionId: past.id },
    ]);

    const links = await prisma.speakerEdition.findMany({ where: { speakerId: person.id } });
    // The point of the refactor: two participations, a single row in Speaker.
    expect(links).toHaveLength(2);
    const sameSlug = await prisma.speaker.findMany({ where: { slug: person.slug } });
    expect(sameSlug).toHaveLength(1);
  });

  it("shows a person on the edition where they are published, not the one where they are a draft", async () => {
    const current = await getSeededEdition();
    const past = await getPastEdition();

    const person = await makePerson("Published Here Draft There", [
      { editionId: current.id, publicationStatus: "PUBLISHED" },
      { editionId: past.id, publicationStatus: "DRAFT" },
    ]);

    const app = await buildApp();
    const list = await app.inject({ method: "GET", url: "/api/speakers" });
    const detail = await app.inject({ method: "GET", url: `/api/speakers/${person.slug}` });
    await app.close();

    // The featured edition is the current one, where the participation is
    // published — so the person surfaces there.
    expect(list.json().map((s: { id: number }) => s.id)).toContain(person.id);
    expect(detail.statusCode).toBe(200);
  });

  it("keeps a draft of the current edition out of the list, yet still serves their page", async () => {
    const current = await getSeededEdition();
    const past = await getPastEdition();

    // Mirror image of the previous case: published on a past edition only.
    const person = await makePerson("Draft Here Published There", [
      { editionId: current.id, publicationStatus: "DRAFT" },
      { editionId: past.id, publicationStatus: "PUBLISHED" },
    ]);

    const app = await buildApp();
    const list = await app.inject({ method: "GET", url: "/api/speakers" });
    const detail = await app.inject({ method: "GET", url: `/api/speakers/${person.slug}` });
    await app.close();

    // This is the subtlest rule of #352, and the two assertions pull apart on
    // purpose: the LIST answers "who is speaking this year" and stays scoped to
    // the featured edition, while the PAGE belongs to the person and exists as
    // soon as they are published on any edition. Before #352 the detail 404ed
    // here, which is exactly what left historical speakers unreachable.
    expect(list.json().map((s: { id: number }) => s.id)).not.toContain(person.id);
    expect(detail.statusCode).toBe(200);
    expect(detail.json().participations.map((p: { year: number }) => p.year)).toEqual([past.year]);
  });

  it("files each talk under the edition it was given at", async () => {
    const current = await getSeededEdition();
    const past = await getPastEdition();

    const person = await makePerson("Talks Two Years", [
      { editionId: current.id },
      { editionId: past.id },
    ]);

    await prisma.talk.create({
      data: {
        editionId: current.id, slug: `identity-current-${uniq()}`, title: "Session de cette année",
        description: "", format: "CONFERENCE", language: "fr", publicationStatus: "PUBLISHED",
        speakers: { connect: { id: person.id } },
      },
    });
    await prisma.talk.create({
      data: {
        editionId: past.id, slug: `identity-past-${uniq()}`, title: "Session d'une autre année",
        description: "", format: "CONFERENCE", language: "fr", publicationStatus: "PUBLISHED",
        speakers: { connect: { id: person.id } },
      },
    });

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/speakers/${person.slug}` });
    await app.close();

    // Both years show on the page since #352, but each session must sit under
    // its own edition: a shared identity must never make a 2019 talk look like
    // it happened this year.
    const participations = res.json().participations;
    const current2026 = participations.find((p: { year: number }) => p.year === current.year);
    const past2019 = participations.find((p: { year: number }) => p.year === past.year);

    expect(current2026.talks.map((t: { title: string }) => t.title)).toEqual(["Session de cette année"]);
    expect(past2019.talks.map((t: { title: string }) => t.title)).toEqual(["Session d'une autre année"]);
  });

  it("keeps a participation for a speaker who has no talk at all", async () => {
    const current = await getSeededEdition();

    // 31 speakers in production have no talk. Their editions cannot be derived
    // from their sessions, which is why the participation is explicit.
    const person = await makePerson("No Talk At All", [{ editionId: current.id }]);

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/speakers" });
    await app.close();

    expect(res.json().map((s: { id: number }) => s.id)).toContain(person.id);
  });

  it("rejects a second speaker reusing a live slug", async () => {
    const current = await getSeededEdition();
    const person = await makePerson("Global Slug", [{ editionId: current.id }]);

    // The slug is unique across editions now, so the DB itself refuses the
    // duplicate — the admin route turns this into a 409 with a rattach hint.
    await expect(
      prisma.speaker.create({ data: { name: "Impostor", slug: person.slug } }),
    ).rejects.toThrow();
  });
});
