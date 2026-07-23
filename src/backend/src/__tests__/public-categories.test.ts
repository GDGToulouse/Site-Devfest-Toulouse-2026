import { describe, it, expect, afterEach } from "vitest";
import Fastify from "fastify";
import categoryRoutes from "../routes/categories.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// #308 — the public /api/categories route had no coverage. Locks the filtering
// (featured edition, not trashed), ordering, and that only public fields ship.
async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(categoryRoutes, { prefix: "/api" });
  return app;
}

const createdIds: number[] = [];

afterEach(async () => {
  if (createdIds.length) {
    await prisma.category.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  }
});

async function makeCategory(editionId: number, overrides: Record<string, unknown> = {}) {
  const c = await prisma.category.create({
    data: { nameFr: "Cat FR", nameEn: "Cat EN", editionId, ...overrides },
  });
  createdIds.push(c.id);
  return c;
}

describe("Public categories (#308)", () => {
  it("lists the featured edition's live categories, ordered by sortOrder", async () => {
    const edition = await getSeededEdition();
    const second = await makeCategory(edition.id, { nameFr: "Deuxième", sortOrder: 900 });
    const first = await makeCategory(edition.id, { nameFr: "Première", sortOrder: 800 });
    const trashed = await makeCategory(edition.id, { nameFr: "Corbeille", sortOrder: 950, deletedAt: new Date() });

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/categories" });
    await app.close();

    expect(res.statusCode).toBe(200);
    const mine = res.json().filter((c: { id: number }) => [first.id, second.id, trashed.id].includes(c.id));
    // Trashed category is excluded.
    expect(mine.map((c: { id: number }) => c.id)).not.toContain(trashed.id);
    // The two live ones appear in sortOrder order.
    const firstIdx = res.json().findIndex((c: { id: number }) => c.id === first.id);
    const secondIdx = res.json().findIndex((c: { id: number }) => c.id === second.id);
    expect(firstIdx).toBeLessThan(secondIdx);
    // Only public fields ship.
    const item = res.json().find((c: { id: number }) => c.id === first.id);
    expect(Object.keys(item).sort()).toEqual(["color", "id", "nameEn", "nameFr"]);
  });
});
