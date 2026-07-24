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

async function createCategory(editionId: number, overrides: Record<string, unknown> = {}) {
  const app = await buildApp();
  const suffix = `${Date.now()}-${Math.round(performance.now() * 1000)}`;
  const res = await app.inject({
    method: "POST",
    url: "/api/admin/categories",
    payload: { editionId, nameFr: `Piste ${suffix}`, nameEn: `Track ${suffix}`, ...overrides },
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

  it("creates a category and reads back the stored values", async () => {
    const edition = await getSeededEdition();
    const res = await createCategory(edition.id, { color: "#abcdef", sortOrder: 3 });
    expect(res.statusCode).toBe(201);
    const { id } = res.json();

    const stored = await prisma.category.findUnique({ where: { id } });
    expect(stored?.editionId).toBe(edition.id);
    expect(stored?.color).toBe("#abcdef");
    expect(stored?.sortOrder).toBe(3);
  });

  it("defaults color and sortOrder when omitted", async () => {
    const edition = await getSeededEdition();
    const { id } = (await createCategory(edition.id)).json();

    const stored = await prisma.category.findUnique({ where: { id } });
    expect(stored?.color).toBe("#109E6E");
    expect(stored?.sortOrder).toBe(0);
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

    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/categories/${id}`,
      payload: { nameFr: "Piste modifiée", color: "#123456" },
    });
    await app.close();
    expect(res.statusCode).toBe(200);

    const stored = await prisma.category.findUnique({ where: { id } });
    expect(stored?.nameFr).toBe("Piste modifiée");
    expect(stored?.color).toBe("#123456");
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
