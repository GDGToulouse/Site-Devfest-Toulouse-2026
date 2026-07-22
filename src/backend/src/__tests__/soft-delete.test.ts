import { describe, it, expect, afterEach } from "vitest";

import Fastify from "fastify";
import adminTalkRoutes from "../routes/admin/talks.js";
import { prisma } from "../lib/prisma.js";
import { isParkedValue, unparkUniqueValue } from "../lib/admin-helpers.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// The existing DELETE tests assert "404 after delete", which a hard delete
// satisfies just as well as a soft one — they would stay green if #147 were
// reverted. These check what actually distinguishes the two: the row survives.

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(adminTalkRoutes, { prefix: "/api/admin" });
  return app;
}

const createdTalkIds: number[] = [];

afterEach(async () => {
  // Hard-delete the fixtures: soft delete is what we are testing, so cleaning
  // up with it would leave rows behind in every run.
  if (createdTalkIds.length) {
    await prisma.talk.deleteMany({ where: { id: { in: createdTalkIds } } });
    createdTalkIds.length = 0;
  }
});

async function createTalk(title: string) {
  const edition = await getSeededEdition();
  const talk = await prisma.talk.create({
    data: {
      editionId: edition.id,
      title,
      description: "Fixture for the soft-delete tests.",
      slug: `soft-delete-fixture-${Date.now()}-${Math.round(performance.now() * 1000)}`,
      format: "CONFERENCE",
      language: "fr",
      publicationStatus: "PUBLISHED",
    },
  });
  createdTalkIds.push(talk.id);
  return talk;
}

describe("soft delete on DELETE /api/admin/talks/:id (#147)", () => {
  it("keeps the row in the database with deletedAt set", async () => {
    const app = await buildApp();
    const talk = await createTalk("Soft delete keeps the row");

    const res = await app.inject({ method: "DELETE", url: `/api/admin/talks/${talk.id}` });
    expect(res.statusCode).toBe(204);

    // The point of the whole feature: the record is still there.
    const stored = await prisma.talk.findUnique({ where: { id: talk.id } });
    expect(stored).not.toBeNull();
    expect(stored?.deletedAt).toBeInstanceOf(Date);

    await app.close();
  });

  it("parks the slug so the live namespace frees up", async () => {
    const app = await buildApp();
    const talk = await createTalk("Soft delete parks the slug");

    await app.inject({ method: "DELETE", url: `/api/admin/talks/${talk.id}` });

    const stored = await prisma.talk.findUnique({ where: { id: talk.id } });
    expect(isParkedValue(stored!.slug)).toBe(true);
    expect(unparkUniqueValue(stored!.slug)).toBe(talk.slug);

    await app.close();
  });

  it("hides the trashed talk from the admin list", async () => {
    const app = await buildApp();
    const talk = await createTalk("Soft delete hides from list");
    const edition = await getSeededEdition();

    const before = await app.inject({
      method: "GET",
      url: `/api/admin/talks?editionId=${edition.id}`,
    });
    expect(before.json().some((t: { id: number }) => t.id === talk.id)).toBe(true);

    await app.inject({ method: "DELETE", url: `/api/admin/talks/${talk.id}` });

    const after = await app.inject({
      method: "GET",
      url: `/api/admin/talks?editionId=${edition.id}`,
    });
    expect(after.json().some((t: { id: number }) => t.id === talk.id)).toBe(false);

    await app.close();
  });

  it("returns 404 on the detail route once trashed", async () => {
    const app = await buildApp();
    const talk = await createTalk("Soft delete 404s on detail");

    await app.inject({ method: "DELETE", url: `/api/admin/talks/${talk.id}` });

    const res = await app.inject({ method: "GET", url: `/api/admin/talks/${talk.id}` });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it("refuses to trash the same talk twice", async () => {
    const app = await buildApp();
    const talk = await createTalk("Soft delete is not idempotent");

    const first = await app.inject({ method: "DELETE", url: `/api/admin/talks/${talk.id}` });
    expect(first.statusCode).toBe(204);

    // A second DELETE must 404 rather than re-stamp deletedAt — otherwise the
    // 30-day purge clock (#145d) would restart on every stray call.
    const second = await app.inject({ method: "DELETE", url: `/api/admin/talks/${talk.id}` });
    expect(second.statusCode).toBe(404);

    await app.close();
  });

  it("frees the slug for a new talk carrying the same title", async () => {
    const app = await buildApp();
    const edition = await getSeededEdition();
    const talk = await createTalk("Soft delete frees the slug");
    const freedSlug = talk.slug;

    await app.inject({ method: "DELETE", url: `/api/admin/talks/${talk.id}` });

    // Parking exists precisely so this insert does not hit the unique index.
    const recreated = await prisma.talk.create({
      data: {
        editionId: edition.id,
        title: "Soft delete frees the slug",
        description: "Recreated after the original went to the trash.",
        slug: freedSlug,
        format: "CONFERENCE",
        language: "fr",
        publicationStatus: "DRAFT",
      },
    });
    createdTalkIds.push(recreated.id);

    expect(recreated.slug).toBe(freedSlug);

    await app.close();
  });
});
