import { describe, it, expect, afterEach } from "vitest";
import Fastify from "fastify";
import speakerRoutes from "../routes/speakers.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// #308 — the public speaker routes had no coverage. These lock the filtering
// (published + not trashed, featured edition) and that private fields never
// leak. Read-mostly, teardown scoped to the ids this file creates.
async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(speakerRoutes, { prefix: "/api" });
  return app;
}

const createdIds: number[] = [];

afterEach(async () => {
  if (createdIds.length) {
    await prisma.talk.deleteMany({ where: { speakers: { some: { id: { in: createdIds } } } } });
    await prisma.speaker.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  }
});

// #351 — publicationStatus and isFeatured moved to the participation, so the
// helper splits its overrides: those two go to SpeakerEdition, the rest stay on
// the identity. Callers keep the pre-#351 signature.
async function makeSpeaker(
  editionId: number,
  { publicationStatus = "PUBLISHED" as const, isFeatured = false, ...identity }: Record<string, unknown> = {},
) {
  const s = await prisma.speaker.create({
    data: {
      name: "Test Speaker",
      slug: `test-speaker-${Date.now()}-${Math.round(performance.now())}`,
      ...identity,
      editions: {
        create: [{ editionId, publicationStatus: publicationStatus as "PUBLISHED" | "DRAFT", isFeatured: isFeatured as boolean }],
      },
    },
  });
  createdIds.push(s.id);
  return s;
}

describe("Public speakers (#308)", () => {
  it("lists only published, non-trashed speakers of the featured edition", async () => {
    const edition = await getSeededEdition();
    const published = await makeSpeaker(edition.id, { name: "Zeta Published" });
    const draft = await makeSpeaker(edition.id, { name: "Alpha Draft", publicationStatus: "DRAFT" });
    const trashed = await makeSpeaker(edition.id, { name: "Beta Trashed", deletedAt: new Date() });

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/speakers" });
    await app.close();

    expect(res.statusCode).toBe(200);
    const ids = res.json().map((s: { id: number }) => s.id);
    expect(ids).toContain(published.id);
    expect(ids).not.toContain(draft.id);
    expect(ids).not.toContain(trashed.id);
    // Private fields never leak on the list.
    const item = res.json().find((s: { id: number }) => s.id === published.id);
    expect(item).not.toHaveProperty("contactEmail");
    expect(item).not.toHaveProperty("editToken");
    expect(item).not.toHaveProperty("bioFr");
  });

  it("returns only featured speakers, capped at 8", async () => {
    const edition = await getSeededEdition();
    const featured = await makeSpeaker(edition.id, { name: "Featured One", isFeatured: true });
    const notFeatured = await makeSpeaker(edition.id, { name: "Not Featured", isFeatured: false });

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/speakers/featured" });
    await app.close();

    expect(res.statusCode).toBe(200);
    const ids = res.json().map((s: { id: number }) => s.id);
    expect(ids).toContain(featured.id);
    expect(ids).not.toContain(notFeatured.id);
    expect(res.json().length).toBeLessThanOrEqual(8);
  });

  it("returns a published speaker's detail with only its published talks", async () => {
    const edition = await getSeededEdition();
    const speaker = await makeSpeaker(edition.id, {
      name: "Detailed Speaker",
      bioFr: "Bio FR",
      contactEmail: "secret@example.org",
      talks: {
        create: [
          { title: "Live Talk", description: "", format: "CONFERENCE", language: "fr", publicationStatus: "PUBLISHED", editionId: edition.id, slug: `live-${Date.now()}` },
          { title: "Draft Talk", description: "", format: "CONFERENCE", language: "fr", publicationStatus: "DRAFT", editionId: edition.id, slug: `draft-${Date.now()}` },
        ],
      },
    });

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/speakers/${speaker.slug}` });
    await app.close();

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe("Detailed Speaker");
    expect(body.bioFr).toBe("Bio FR");
    // Private field never leaks even on the detail route.
    expect(body).not.toHaveProperty("contactEmail");
    // Only the published talk shows up.
    const titles = body.talks.map((t: { title: string }) => t.title);
    expect(titles).toContain("Live Talk");
    expect(titles).not.toContain("Draft Talk");
  });

  it("404s for an unknown or unpublished slug", async () => {
    const edition = await getSeededEdition();
    const draft = await makeSpeaker(edition.id, { name: "Hidden", slug: `hidden-${Date.now()}`, publicationStatus: "DRAFT" });

    const app = await buildApp();
    const missing = await app.inject({ method: "GET", url: "/api/speakers/does-not-exist-xyz" });
    const unpublished = await app.inject({ method: "GET", url: `/api/speakers/${draft.slug}` });
    await app.close();

    expect(missing.statusCode).toBe(404);
    expect(unpublished.statusCode).toBe(404);
  });
});
