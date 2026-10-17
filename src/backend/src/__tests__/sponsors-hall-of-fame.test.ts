import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import sponsorRoutes from "../routes/sponsors.js";
import { prisma } from "../lib/prisma.js";

// #611 — every company that ever sponsored the DevFest, with the years it did.
// Published participations only, on live editions, for companies out of the
// trash: a draft year or a trashed edition must not surface on a public page.

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let app: FastifyInstance;
const ids = { editions: [] as number[], sponsors: [] as number[], tier: 0 };
const slug = (name: string) => `hof-${name}-${stamp}`;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(sponsorRoutes, { prefix: "/api" });
  await app.ready();

  // Past years of their own, so the featured edition never moves.
  const [y1, y2, trashedYear] = await Promise.all(
    [1560, 1561, 1562].map((year, i) =>
      prisma.edition.create({ data: { year, ...(i === 2 ? { deletedAt: new Date() } : {}) } }),
    ),
  );
  ids.editions.push(y1.id, y2.id, trashedYear.id);
  ids.tier = (await prisma.sponsorTier.create({ data: { key: slug("tier"), nameFr: "Or", nameEn: "Gold" } })).id;

  const make = (name: string, editions: { editionId: number; publicationStatus: "DRAFT" | "PUBLISHED"; logoUrl?: string; tierNameFr?: string }[], deletedAt?: Date) =>
    prisma.sponsor.create({
      data: {
        slug: slug(name),
        name: `HoF ${name}`,
        logoUrl: "/uploads/today.png",
        deletedAt: deletedAt ?? null,
        editions: { create: editions.map((e) => ({ ...e, tierId: ids.tier })) },
      },
    });
  const sponsors = await Promise.all([
    make("loyal", [
      { editionId: y1.id, publicationStatus: "PUBLISHED", logoUrl: "/uploads/1560.png", tierNameFr: "Or 1560" },
      { editionId: y2.id, publicationStatus: "PUBLISHED" },
    ]),
    make("draft", [{ editionId: y1.id, publicationStatus: "DRAFT" }]),
    make("trashed", [{ editionId: y1.id, publicationStatus: "PUBLISHED" }], new Date()),
    make("lost-year", [{ editionId: trashedYear.id, publicationStatus: "PUBLISHED" }]),
  ]);
  ids.sponsors.push(...sponsors.map((s) => s.id));
});

afterAll(async () => {
  await app.close();
  await prisma.sponsor.deleteMany({ where: { id: { in: ids.sponsors } } });
  await prisma.edition.deleteMany({ where: { id: { in: ids.editions } } });
  await prisma.sponsorTier.delete({ where: { id: ids.tier } });
});

describe("GET /api/sponsors/hall-of-fame (#611)", () => {
  it("should list each company once, with its published years as each year displayed it", async () => {
    const res = await app.inject({ method: "GET", url: "/api/sponsors/hall-of-fame" });
    const loyal = res.json().find((c: { slug: string }) => c.slug === slug("loyal"));

    expect(res.statusCode).toBe(200);
    expect(loyal).toMatchObject({ name: "HoF loyal", logoUrl: "/uploads/today.png" });
    expect(loyal.participations).toEqual([
      expect.objectContaining({ year: 1561, logoUrl: "/uploads/today.png", tier: expect.objectContaining({ nameFr: "Or" }) }),
      expect.objectContaining({ year: 1560, logoUrl: "/uploads/1560.png", tier: expect.objectContaining({ nameFr: "Or 1560" }) }),
    ]);
  });

  it("should leave out drafts, trashed companies and trashed editions", async () => {
    const res = await app.inject({ method: "GET", url: "/api/sponsors/hall-of-fame" });
    const slugs = res.json().map((c: { slug: string }) => c.slug);

    expect(slugs).not.toContain(slug("draft"));
    expect(slugs).not.toContain(slug("trashed"));
    expect(slugs).not.toContain(slug("lost-year"));
  });
});
