// Set env vars needed by Better Auth before any imports (mirrors test-admin-app).
process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import adminSpeakerRoutes from "../routes/admin/speakers.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// test-admin-app.ts does NOT register the speakers routes, so this file builds
// its own minimal app — same pattern as the trash/tickets tests. No auth guard,
// no multipart (the speakers route reads only JSON bodies), just the route under
// test mounted under the real "/api/admin" prefix.
async function buildSpeakersApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(adminSpeakerRoutes, { prefix: "/api/admin" });
  return app;
}

// Every speaker this file creates is tracked here so teardown can be scoped to
// exactly these ids. #308: never `deleteMany({ deletedAt: { not: null } })` —
// that reaches across parallel test files and wipes their fixtures. The DELETE
// endpoint only soft-deletes (#147), so a real purge at the end is required to
// stop parked slugs from accumulating in the unique index across runs.
const createdSpeakerIds: number[] = [];

afterAll(async () => {
  if (createdSpeakerIds.length > 0) {
    await prisma.speaker.deleteMany({ where: { id: { in: createdSpeakerIds } } });
  }
  // No `prisma.$disconnect()` here: the client is a shared singleton across all
  // test files, and Vitest runs them in parallel — disconnecting would cut the
  // connection out from under files still running. No other test file does it.
});

describe("Admin Speakers API", () => {
  it("GET /api/admin/speakers returns 200 and an array", async () => {
    const app = await buildSpeakersApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/speakers" });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
    await app.close();
  });

  it("POST creates a speaker (201) and the row lands in the DB with a derived slug", async () => {
    const app = await buildSpeakersApp();
    const edition = await getSeededEdition();
    // Unique name so the derived slug can't collide with a parallel run (#292).
    const name = `Ada Lovelace ${Date.now()}`;

    const createRes = await app.inject({
      method: "POST",
      url: "/api/admin/speakers",
      payload: { editionId: edition.id, name, company: "Analytical Engine", city: "London" },
    });
    expect(createRes.statusCode).toBe(201);
    const { id } = createRes.json();
    expect(id).toBeDefined();
    createdSpeakerIds.push(id);

    // Assert against the stored row, not just the HTTP status: the values must
    // have actually persisted, and the slug must be derived from the name.
    const stored = await prisma.speaker.findUnique({
      where: { id },
      include: { editions: true },
    });
    expect(stored).not.toBeNull();
    expect(stored!.name).toBe(name);
    expect(stored!.company).toBe("Analytical Engine");
    expect(stored!.slug).toContain("ada-lovelace");
    // #351: the create attaches the person to the posted edition through a
    // participation, which is what now carries the publication status.
    expect(stored!.editions).toHaveLength(1);
    expect(stored!.editions[0].editionId).toBe(edition.id);
    expect(stored!.editions[0].publicationStatus).toBe("DRAFT");

    await app.close();
  });

  it("GET /api/admin/speakers/:id returns the right speaker, 404 for an unknown id", async () => {
    const app = await buildSpeakersApp();
    const edition = await getSeededEdition();
    const name = `Grace Hopper ${Date.now()}`;

    const createRes = await app.inject({
      method: "POST",
      url: "/api/admin/speakers",
      payload: { editionId: edition.id, name },
    });
    const { id } = createRes.json();
    createdSpeakerIds.push(id);

    const getRes = await app.inject({ method: "GET", url: `/api/admin/speakers/${id}` });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().id).toBe(id);
    expect(getRes.json().name).toBe(name);

    // 999999999 is well past any seeded/created id, so it reliably 404s.
    const missing = await app.inject({ method: "GET", url: "/api/admin/speakers/999999999" });
    expect(missing.statusCode).toBe(404);

    await app.close();
  });

  it("PUT updates a speaker (200) and the change persists in the DB", async () => {
    const app = await buildSpeakersApp();
    const edition = await getSeededEdition();

    const createRes = await app.inject({
      method: "POST",
      url: "/api/admin/speakers",
      payload: { editionId: edition.id, name: `Edsger Dijkstra ${Date.now()}` },
    });
    const { id } = createRes.json();
    createdSpeakerIds.push(id);

    const updateRes = await app.inject({
      method: "PUT",
      url: `/api/admin/speakers/${id}`,
      // #351: publicationStatus targets a participation, so the edition must be
      // named. company stays on the identity.
      payload: { editionId: edition.id, company: "Eindhoven University", publicationStatus: "PUBLISHED" },
    });
    expect(updateRes.statusCode).toBe(200);

    // Read straight from the DB: a 200 alone wouldn't prove the write landed.
    const stored = await prisma.speaker.findUnique({
      where: { id },
      include: { editions: { where: { editionId: edition.id } } },
    });
    expect(stored!.company).toBe("Eindhoven University");
    expect(stored!.editions[0].publicationStatus).toBe("PUBLISHED");

    await app.close();
  });

  it("POST/PUT round-trips socialLinks through the JSON column", async () => {
    const app = await buildSpeakersApp();
    const edition = await getSeededEdition();
    const socialLinks = { twitter: "https://x.com/ada", github: "https://github.com/ada" };

    const createRes = await app.inject({
      method: "POST",
      url: "/api/admin/speakers",
      payload: { editionId: edition.id, name: `Social Speaker ${Date.now()}`, socialLinks },
    });
    expect(createRes.statusCode).toBe(201);
    const { id } = createRes.json();
    createdSpeakerIds.push(id);

    // The API serializes socialLinks back to an object.
    expect(createRes.json().socialLinks).toEqual(socialLinks);

    // And the raw column holds the JSON string the route wrote.
    const stored = await prisma.speaker.findUnique({ where: { id } });
    expect(JSON.parse(stored!.socialLinks!)).toEqual(socialLinks);

    await app.close();
  });

  it("DELETE soft-deletes: the row survives with deletedAt set and its slug parked", async () => {
    const app = await buildSpeakersApp();
    const edition = await getSeededEdition();

    const createRes = await app.inject({
      method: "POST",
      url: "/api/admin/speakers",
      payload: { editionId: edition.id, name: `Trash Me ${Date.now()}` },
    });
    const { id } = createRes.json();
    createdSpeakerIds.push(id);

    const originalSlug = (await prisma.speaker.findUnique({ where: { id } }))!.slug;

    const delRes = await app.inject({ method: "DELETE", url: `/api/admin/speakers/${id}` });
    expect(delRes.statusCode).toBe(204);

    // The key distinction (#147): the row is NOT gone. A hard delete or a no-op
    // would both look like success from the status code alone — assert the row
    // still exists, that deletedAt is a real Date, and that the slug was parked
    // out of the live namespace so the name can be reused (#146).
    const stored = await prisma.speaker.findUnique({ where: { id } });
    expect(stored).not.toBeNull();
    expect(stored!.deletedAt).toBeInstanceOf(Date);
    expect(stored!.slug).not.toBe(originalSlug);
    expect(stored!.slug).toContain("__trash_");

    // The GET endpoint filters on deletedAt, so a trashed speaker reads as 404.
    const getRes = await app.inject({ method: "GET", url: `/api/admin/speakers/${id}` });
    expect(getRes.statusCode).toBe(404);

    await app.close();
  });

  it("POST rejects a missing required field with 400", async () => {
    const app = await buildSpeakersApp();
    const edition = await getSeededEdition();

    // name is required alongside editionId — omitting it is a 400.
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/speakers",
      payload: { editionId: edition.id },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("required");

    await app.close();
  });

  it("POST answers 409 with the existing person instead of forking the identity (#351)", async () => {
    const app = await buildSpeakersApp();
    const edition = await getSeededEdition();
    const name = `Barbara Liskov ${Date.now()}`;

    const first = await app.inject({
      method: "POST",
      url: "/api/admin/speakers",
      payload: { editionId: edition.id, name },
    });
    expect(first.statusCode).toBe(201);
    createdSpeakerIds.push(first.json().id);

    // Before #351 this derived `barbara-liskov-2` and created a second person.
    // The slug now identifies a human, so the same name must be reported as an
    // existing identity the admin can attach to another edition.
    const second = await app.inject({
      method: "POST",
      url: "/api/admin/speakers",
      payload: { editionId: edition.id, name },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().existingSpeakerId).toBe(first.json().id);
    expect(second.json().existingSpeakerName).toBe(name);

    await app.close();
  });

  it("POST /speakers/:id/editions attaches an existing person to another edition", async () => {
    const app = await buildSpeakersApp();
    const current = await getSeededEdition();
    const past = await prisma.edition.findFirstOrThrow({
      where: { year: { lt: 2020 } },
      orderBy: { year: "asc" },
    });

    const createRes = await app.inject({
      method: "POST",
      url: "/api/admin/speakers",
      payload: { editionId: current.id, name: `Radia Perlman ${Date.now()}` },
    });
    const { id } = createRes.json();
    createdSpeakerIds.push(id);

    const attachRes = await app.inject({
      method: "POST",
      url: `/api/admin/speakers/${id}/editions`,
      payload: { editionId: past.id, publicationStatus: "PUBLISHED" },
    });
    expect(attachRes.statusCode).toBe(200);

    // One person, two participations — the answer the 409 above points to.
    const years = attachRes.json().editions.map((e: { year: number }) => e.year);
    expect(years).toContain(current.year);
    expect(years).toContain(past.year);

    // Detaching is idempotent: the second call must not 404.
    const first = await app.inject({ method: "DELETE", url: `/api/admin/speakers/${id}/editions/${past.id}` });
    const again = await app.inject({ method: "DELETE", url: `/api/admin/speakers/${id}/editions/${past.id}` });
    expect(first.statusCode).toBe(204);
    expect(again.statusCode).toBe(204);

    await app.close();
  });

  it("POST /api/admin/speakers/bulk rejects an empty ids array with 400", async () => {
    const app = await buildSpeakersApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/speakers/bulk",
      payload: { ids: [], action: "setStatus", value: "PUBLISHED" },
    });
    expect(res.statusCode).toBe(400);

    await app.close();
  });

  it("POST /api/admin/speakers/bulk applies setStatus to the given ids", async () => {
    const app = await buildSpeakersApp();
    const edition = await getSeededEdition();

    const createRes = await app.inject({
      method: "POST",
      url: "/api/admin/speakers",
      payload: { editionId: edition.id, name: `Bulk Target ${Date.now()}` },
    });
    const { id } = createRes.json();
    createdSpeakerIds.push(id);

    const bulkRes = await app.inject({
      method: "POST",
      url: "/api/admin/speakers/bulk",
      payload: { ids: [id], editionId: edition.id, action: "setStatus", value: "PUBLISHED" },
    });
    expect(bulkRes.statusCode).toBe(200);
    expect(bulkRes.json().count).toBe(1);

    const stored = await prisma.speaker.findUnique({
      where: { id },
      include: { editions: { where: { editionId: edition.id } } },
    });
    expect(stored!.editions[0].publicationStatus).toBe("PUBLISHED");

    await app.close();
  });
});
