import { describe, it, expect, afterEach } from "vitest";

import Fastify from "fastify";
import adminCategoryRoutes from "../routes/admin/categories.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// admin/categories had no test at all before #308. Like the trash/tickets tests,
// test-admin-app.ts does not register this route, so we build a minimal app.
async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(adminCategoryRoutes, { prefix: "/api/admin" });
  return app;
}

// Teardown scoped to this file's rows, tracked by id — never a broad deleteMany
// that would hit rows other parallel files created (#292 / #308).
const createdIds: number[] = [];

afterEach(async () => {
  if (createdIds.length) {
    await prisma.category.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  }
});

// Since #338 a category is global and `editionIds` binds it to editions.
async function createCategory(editionId: number, overrides: Record<string, unknown> = {}) {
  const app = await buildApp();
  const suffix = `${Date.now()}-${Math.round(performance.now() * 1000)}`;
  const res = await app.inject({
    method: "POST",
    url: "/api/admin/categories",
    payload: {
      editionIds: [editionId],
      nameFr: `Piste ${suffix}`,
      nameEn: `Track ${suffix}`,
      ...overrides,
    },
  });
  await app.close();
  if (res.statusCode === 201) createdIds.push(res.json().id);
  return res;
}

describe("Admin Categories API (#308)", () => {
  it("lists categories", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/categories" });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
    await app.close();
  });

  it("creates a category bound to the given edition", async () => {
    const edition = await getSeededEdition();
    const res = await createCategory(edition.id, { color: "#abcdef" });
    expect(res.statusCode).toBe(201);
    const { id } = res.json();

    const stored = await prisma.category.findUnique({ where: { id } });
    expect(stored?.color).toBe("#abcdef");
    // The edition binding lives on the join since #338.
    const link = await prisma.editionCategory.findFirst({ where: { categoryId: id } });
    expect(link?.editionId).toBe(edition.id);
    expect(res.json().editions).toHaveLength(1);
  });

  it("defaults the colour when omitted", async () => {
    const edition = await getSeededEdition();
    const { id } = (await createCategory(edition.id)).json();

    const stored = await prisma.category.findUnique({ where: { id } });
    expect(stored?.color).toBe("#109E6E");
  });

  it("returns a category by id, 404 for an unknown one", async () => {
    const edition = await getSeededEdition();
    const { id } = (await createCategory(edition.id)).json();

    const app = await buildApp();
    const found = await app.inject({ method: "GET", url: `/api/admin/categories/${id}` });
    expect(found.statusCode).toBe(200);
    expect(found.json().id).toBe(id);

    const missing = await app.inject({ method: "GET", url: "/api/admin/categories/99999999" });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it("persists a PUT to the stored row", async () => {
    const edition = await getSeededEdition();
    const { id } = (await createCategory(edition.id)).json();

    const renamed = `Piste modifiée ${Date.now()}`;
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/categories/${id}`,
      payload: { nameFr: renamed, color: "#123456" },
    });
    await app.close();
    expect(res.statusCode).toBe(200);

    const stored = await prisma.category.findUnique({ where: { id } });
    expect(stored?.nameFr).toBe(renamed);
    expect(stored?.color).toBe("#123456");
  });

  // --- #338: the track is shared, the edition binding is editable.

  it("shares one category across several editions", async () => {
    const edition = await getSeededEdition();
    // Seeded range only, like getSeededEdition itself (#292): other files create
    // editions below 2016 and delete them on teardown, so picking one here raced
    // with their cleanup and surfaced as a 500 on a foreign key.
    const other = await prisma.edition.findFirst({
      where: { id: { not: edition.id }, deletedAt: null, year: { gte: 2016 } },
    });
    if (!other) return; // single-edition seed: nothing to share with.

    const { id } = (await createCategory(edition.id)).json();

    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/categories/${id}`,
      payload: { editionIds: [edition.id, other.id] },
    });
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(res.json().editions.map((e: { id: number }) => e.id).sort()).toEqual(
      [edition.id, other.id].sort(),
    );
    // One row, two bindings — not two duplicated tracks.
    const links = await prisma.editionCategory.count({ where: { categoryId: id } });
    expect(links).toBe(2);
  });

  it("replaces the edition selection wholesale, dropping the ones removed", async () => {
    const edition = await getSeededEdition();
    const { id } = (await createCategory(edition.id)).json();

    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/categories/${id}`,
      payload: { editionIds: [] },
    });
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(await prisma.editionCategory.count({ where: { categoryId: id } })).toBe(0);
  });

  it("refuses a duplicate name — the track identifies itself globally", async () => {
    const edition = await getSeededEdition();
    const first = (await createCategory(edition.id)).json();

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/categories",
      payload: { editionIds: [edition.id], nameFr: first.nameFr, nameEn: "Other" },
    });
    await app.close();
    expect(res.statusCode).toBe(409);
  });

  it("rejects an unknown edition instead of silently ignoring it", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/categories",
      payload: { editionIds: [99999999], nameFr: `X ${Date.now()}`, nameEn: "X" },
    });
    await app.close();
    expect(res.statusCode).toBe(422);
  });

  it("frees the name when trashed, so the same track can be recreated", async () => {
    const edition = await getSeededEdition();
    const created = (await createCategory(edition.id)).json();

    const app = await buildApp();
    await app.inject({ method: "DELETE", url: `/api/admin/categories/${created.id}` });

    // The trashed row parked its name, so the slot is free again.
    const again = await app.inject({
      method: "POST",
      url: "/api/admin/categories",
      payload: { editionIds: [edition.id], nameFr: created.nameFr, nameEn: created.nameEn },
    });
    await app.close();

    expect(again.statusCode).toBe(201);
    createdIds.push(again.json().id);
  });

  it("soft-deletes on DELETE, keeping the row with deletedAt set (#147)", async () => {
    const edition = await getSeededEdition();
    const { id } = (await createCategory(edition.id)).json();

    const app = await buildApp();
    const del = await app.inject({ method: "DELETE", url: `/api/admin/categories/${id}` });
    await app.close();
    expect(del.statusCode).toBe(204);

    // Distinguishes a soft delete from a hard delete / no-op, which a status
    // check alone cannot.
    const stored = await prisma.category.findUnique({ where: { id } });
    expect(stored).not.toBeNull();
    expect(stored?.deletedAt).toBeInstanceOf(Date);
  });

  it("hides a trashed category from the list", async () => {
    const edition = await getSeededEdition();
    const { id } = (await createCategory(edition.id)).json();

    const app = await buildApp();
    await app.inject({ method: "DELETE", url: `/api/admin/categories/${id}` });

    const list = await app.inject({ method: "GET", url: `/api/admin/categories?editionId=${edition.id}` });
    expect(list.json().some((c: { id: number }) => c.id === id)).toBe(false);
    await app.close();
  });

  it("rejects a create missing required fields", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/categories",
      payload: { nameFr: "", nameEn: "" },
    });
    await app.close();
    expect(res.statusCode).toBe(400);
  });
});
