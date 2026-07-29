process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

// Every helper is stubbed: this file asserts *which* purge each mutation asks
// for, not that the frontend answers. A missing call is invisible otherwise —
// nothing fails, the page just serves a stale version for an hour (#360).
vi.mock("../lib/revalidate.js", () => ({
  revalidateSponsors: vi.fn(),
  revalidateSponsor: vi.fn(),
  revalidateConferences: vi.fn(),
  revalidateTalk: vi.fn(),
  revalidateJobOffers: vi.fn(),
}));

const { revalidateSponsor, revalidateTalk } = await import("../lib/revalidate.js");
const adminSponsorRoutes = (await import("../routes/admin/sponsors.js")).default;
const adminTalkRoutes = (await import("../routes/admin/talks.js")).default;
const { prisma } = await import("../lib/prisma.js");
const { getSeededEdition } = await import("./edition-test-helpers.js");

async function buildApp(
  register: (app: FastifyInstance) => Promise<void>,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await register(app);
  return app;
}

const createdSponsorIds: number[] = [];
const createdTalkIds: number[] = [];
const uniq = () => `${Date.now()}-${Math.round(performance.now())}`;

afterAll(async () => {
  if (createdTalkIds.length) {
    await prisma.talk.deleteMany({ where: { id: { in: createdTalkIds } } });
  }
  if (createdSponsorIds.length) {
    await prisma.sponsor.deleteMany({ where: { id: { in: createdSponsorIds } } });
  }
});

beforeEach(() => {
  vi.mocked(revalidateSponsor).mockClear();
  vi.mocked(revalidateTalk).mockClear();
});

describe("sponsor mutations purge the sponsor's own page (#360)", () => {
  it("purges on create, update and delete", async () => {
    const edition = await getSeededEdition();
    const tier = await prisma.sponsorTier.findFirstOrThrow();
    const app = await buildApp(async (a) => {
      await a.register(adminSponsorRoutes, { prefix: "/api/admin" });
    });

    const createRes = await app.inject({
      method: "POST",
      url: "/api/admin/sponsors",
      payload: { editionId: edition.id, tierId: tier.id, name: `Purge Sponsor ${uniq()}` },
    });
    expect(createRes.statusCode).toBe(201);
    const { id, slug } = createRes.json();
    createdSponsorIds.push(id);
    expect(revalidateSponsor).toHaveBeenCalledWith(slug);

    vi.mocked(revalidateSponsor).mockClear();
    const putRes = await app.inject({
      method: "PUT",
      url: `/api/admin/sponsors/${id}`,
      payload: { websiteUrl: "https://example.org" },
    });
    expect(putRes.statusCode).toBe(200);
    expect(revalidateSponsor).toHaveBeenCalledWith(slug);

    vi.mocked(revalidateSponsor).mockClear();
    const delRes = await app.inject({ method: "DELETE", url: `/api/admin/sponsors/${id}` });
    expect(delRes.statusCode).toBe(204);
    // The slug it was public under, not the parked one it now carries.
    expect(revalidateSponsor).toHaveBeenCalledWith(slug);

    await app.close();
  });
});

describe("talk mutations purge both of the talk's URLs (#360)", () => {
  it("purges on create, update and delete, with the edition year", async () => {
    const edition = await getSeededEdition();
    const app = await buildApp(async (a) => {
      await a.register(adminTalkRoutes, { prefix: "/api/admin" });
    });

    const createRes = await app.inject({
      method: "POST",
      url: "/api/admin/talks",
      payload: {
        editionId: edition.id,
        title: `Purge Talk ${uniq()}`,
        format: "CONFERENCE",
        language: "fr",
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { id, slug } = createRes.json();
    createdTalkIds.push(id);
    // The year is what makes /editions/<year>/conferences/<slug> reachable —
    // without it only half the talk's pages would be purged.
    expect(revalidateTalk).toHaveBeenCalledWith(slug, edition.year);

    vi.mocked(revalidateTalk).mockClear();
    const putRes = await app.inject({
      method: "PUT",
      url: `/api/admin/talks/${id}`,
      payload: { title: `Purge Talk renamed ${uniq()}` },
    });
    expect(putRes.statusCode).toBe(200);
    expect(revalidateTalk).toHaveBeenCalledWith(slug, edition.year);

    vi.mocked(revalidateTalk).mockClear();
    const delRes = await app.inject({ method: "DELETE", url: `/api/admin/talks/${id}` });
    expect(delRes.statusCode).toBe(204);
    expect(revalidateTalk).toHaveBeenCalledWith(slug, edition.year);

    await app.close();
  });
});
