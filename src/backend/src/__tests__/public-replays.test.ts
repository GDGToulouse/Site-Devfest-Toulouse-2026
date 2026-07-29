import { describe, it, expect, afterEach } from "vitest";
import Fastify from "fastify";

import replayRoutes from "../routes/replays.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// #102 — the Hall of replays aggregates filmed talks across every edition. These
// lock what belongs in that list (published, not trashed, with a video) and the
// server-side search/filters. Fixtures are scoped to the ids this file creates,
// so parallel test files cannot interfere (#292).
async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(replayRoutes, { prefix: "/api" });
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
  const t = await prisma.talk.create({
    data: {
      title: "Replay Test Talk",
      description: "",
      format: "CONFERENCE",
      language: "fr",
      publicationStatus: "PUBLISHED",
      videoUrl: "https://www.youtube.com/watch?v=test",
      editionId,
      slug: `replay-test-${uniq()}`,
      ...overrides,
    },
  });
  talkIds.push(t.id);
  return t;
}

/** Fetch only the rows this test created, ignoring any real catalogue data. */
function mine(body: { slug: string }[], slugs: string[]) {
  return body.filter((r) => slugs.includes(r.slug));
}

describe("Public replays (#102)", () => {
  it("lists only published, non-trashed talks that actually have a video", async () => {
    const edition = await getSeededEdition();
    const filmed = await makeTalk(edition.id, { title: "Filmed Talk" });
    const noVideo = await makeTalk(edition.id, { title: "Unfilmed Talk", videoUrl: null });
    const draft = await makeTalk(edition.id, { title: "Draft Talk", publicationStatus: "DRAFT" });
    const trashed = await makeTalk(edition.id, { title: "Trashed Talk", deletedAt: new Date() });

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/replays" });
    await app.close();

    expect(res.statusCode).toBe(200);
    const slugs = res.json().map((r: { slug: string }) => r.slug);
    expect(slugs).toContain(filmed.slug);
    expect(slugs).not.toContain(noVideo.slug);
    expect(slugs).not.toContain(draft.slug);
    expect(slugs).not.toContain(trashed.slug);
  });

  it("carries the edition year so a replay can be traced back to its edition", async () => {
    const edition = await getSeededEdition();
    const talk = await makeTalk(edition.id, { title: "Year Carrying Talk" });

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/replays" });
    await app.close();

    const found = res.json().find((r: { slug: string }) => r.slug === talk.slug);
    expect(found.year).toBe(edition.year);
    expect(found.videoUrl).toBe("https://www.youtube.com/watch?v=test");
  });

  it("searches on the talk title", async () => {
    const edition = await getSeededEdition();
    const match = await makeTalk(edition.id, { title: "Kubernetes en profondeur" });
    const other = await makeTalk(edition.id, { title: "Un sujet sans rapport" });

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/replays?q=kubernetes" });
    await app.close();

    const slugs = res.json().map((r: { slug: string }) => r.slug);
    expect(slugs).toContain(match.slug);
    expect(slugs).not.toContain(other.slug);
  });

  it("searches on a speaker name, not just the title", async () => {
    const edition = await getSeededEdition();
    const speaker = await prisma.speaker.create({
      data: {
        name: "Grace Hopper Replay",
        slug: `grace-replay-${uniq()}`,
        editions: { create: [{ editionId: edition.id, publicationStatus: "PUBLISHED" }] },
      },
    });
    speakerIds.push(speaker.id);

    const bySpeaker = await makeTalk(edition.id, {
      title: "Titre neutre",
      speakers: { connect: { id: speaker.id } },
    });
    const unrelated = await makeTalk(edition.id, { title: "Autre titre neutre" });

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/replays?q=grace%20hopper%20replay" });
    await app.close();

    const slugs = res.json().map((r: { slug: string }) => r.slug);
    expect(slugs).toContain(bySpeaker.slug);
    expect(slugs).not.toContain(unrelated.slug);
  });

  it("filters by format and by year", async () => {
    const edition = await getSeededEdition();
    const keynote = await makeTalk(edition.id, { title: "La keynote", format: "KEYNOTE" });
    const conference = await makeTalk(edition.id, { title: "La conférence", format: "CONFERENCE" });

    const app = await buildApp();
    const byFormat = await app.inject({ method: "GET", url: "/api/replays?format=KEYNOTE" });
    const byYear = await app.inject({ method: "GET", url: `/api/replays?year=${edition.year}` });
    const otherYear = await app.inject({ method: "GET", url: "/api/replays?year=1999" });
    await app.close();

    const formatSlugs = byFormat.json().map((r: { slug: string }) => r.slug);
    expect(formatSlugs).toContain(keynote.slug);
    expect(formatSlugs).not.toContain(conference.slug);

    const yearSlugs = byYear.json().map((r: { slug: string }) => r.slug);
    expect(yearSlugs).toContain(keynote.slug);

    // A year with no edition yields an empty list, not every replay.
    expect(mine(otherYear.json(), [keynote.slug, conference.slug])).toHaveLength(0);
  });

  it("rejects a non-numeric year instead of ignoring it", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/replays?year=abc" });
    await app.close();

    expect(res.statusCode).toBe(400);
  });

  it("exposes only filter values that have replays behind them", async () => {
    const edition = await getSeededEdition();
    await makeTalk(edition.id, { title: "Quickie filmé", format: "QUICKIE" });

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/replays/filters" });
    await app.close();

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.years).toContain(edition.year);
    expect(body.formats).toContain("QUICKIE");
    expect(body.total).toBeGreaterThan(0);
    // Years come newest first, so the UI can render them as-is.
    expect(body.years).toEqual([...body.years].sort((a: number, b: number) => b - a));
  });

  it("never leaks a trashed speaker under a live replay", async () => {
    const edition = await getSeededEdition();
    const ghost = await prisma.speaker.create({
      data: {
        name: "Trashed Speaker Replay",
        slug: `ghost-replay-${uniq()}`,
        deletedAt: new Date(),
        editions: { create: [{ editionId: edition.id, publicationStatus: "PUBLISHED" }] },
      },
    });
    speakerIds.push(ghost.id);

    const talk = await makeTalk(edition.id, {
      title: "Talk avec speaker en corbeille",
      speakers: { connect: { id: ghost.id } },
    });

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/replays" });
    await app.close();

    const found = res.json().find((r: { slug: string }) => r.slug === talk.slug);
    expect(found.speakers).toHaveLength(0);
  });
});
