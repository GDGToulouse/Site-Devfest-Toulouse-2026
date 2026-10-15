process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

// Every helper is stubbed: this file asserts *which* purge each mutation asks
// for, not that the frontend answers. A missing call is invisible otherwise —
// nothing fails, the page just serves a stale version for an hour (#360).
//
// The path builders stay real: the footprint helpers (#633) compose them, and
// what is asserted is the list of paths that reaches revalidatePaths.
vi.mock("../lib/revalidate.js", async (importActual) => ({
  ...(await importActual<typeof import("../lib/revalidate.js")>()),
  revalidatePaths: vi.fn(),
  revalidateSponsors: vi.fn(),
  revalidateSponsor: vi.fn(),
  revalidateSpeakers: vi.fn(),
  revalidateConferences: vi.fn(),
  revalidateJobOffers: vi.fn(),
  revalidateJobOfferPages: vi.fn(),
}));

const { revalidateSponsor, revalidatePaths } = await import("../lib/revalidate.js");
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
  vi.mocked(revalidatePaths).mockClear();
});

/** Every path purged since the last clear, flattened. */
function purgedPaths(): string[] {
  return vi.mocked(revalidatePaths).mock.calls.flatMap(([paths]) => paths ?? []);
}

/** Both addresses of a talk, in French, as revalidateTalk used to purge them. */
function talkPages(slug: string, year: number): string[] {
  return [`/fr/conferences/${slug}`, `/fr/editions/${year}/conferences/${slug}`];
}

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
    expect(purgedPaths()).toEqual(expect.arrayContaining(talkPages(slug, edition.year)));

    vi.mocked(revalidatePaths).mockClear();
    const putRes = await app.inject({
      method: "PUT",
      url: `/api/admin/talks/${id}`,
      payload: { title: `Purge Talk renamed ${uniq()}` },
    });
    expect(putRes.statusCode).toBe(200);
    expect(purgedPaths()).toEqual(expect.arrayContaining(talkPages(slug, edition.year)));

    vi.mocked(revalidatePaths).mockClear();
    const delRes = await app.inject({ method: "DELETE", url: `/api/admin/talks/${id}` });
    expect(delRes.statusCode).toBe(204);
    expect(purgedPaths()).toEqual(expect.arrayContaining(talkPages(slug, edition.year)));

    await app.close();
  });
});

// #609 — a job offer shows on its sponsor's own page. Purging only the lists
// left a created, edited or restored offer missing there for an hour.
describe("job offer mutations purge the sponsor's own page (#609)", () => {
  it("purges on create, update, delete and restore", async () => {
    const { revalidateJobOfferPages } = await import("../lib/revalidate.js");
    const adminJobOfferRoutes = (await import("../routes/admin/job-offers.js")).default;
    const adminTrashRoutes = (await import("../routes/admin/trash.js")).default;
    const { createSponsorFixture } = await import("./sponsor-test-helpers.js");
    const edition = await getSeededEdition();
    const tier = await prisma.sponsorTier.findFirstOrThrow();
    const sponsor = await createSponsorFixture({ name: `Purge Offer ${uniq()}`, slug: `purge-offer-${uniq()}`, editionId: edition.id, tierId: tier.id });
    createdSponsorIds.push(sponsor.id);
    const app = await buildApp(async (a) => {
      await a.register(adminJobOfferRoutes, { prefix: "/api/admin" });
      await a.register(adminTrashRoutes, { prefix: "/api/admin" });
    });
    const purges = () => vi.mocked(revalidateJobOfferPages).mock.calls.map(([slug]) => slug);
    vi.mocked(revalidateJobOfferPages).mockClear();

    const created = await app.inject({
      method: "POST",
      url: `/api/admin/sponsors/${sponsor.id}/editions/${edition.id}/job-offers`,
      payload: { title: "Purge", url: "https://example.org/jobs/1" },
    });
    const offerId = created.json().id;
    await app.inject({ method: "PUT", url: `/api/admin/job-offers/${offerId}`, payload: { title: "Purge 2" } });
    await app.inject({ method: "DELETE", url: `/api/admin/job-offers/${offerId}` });
    const restored = await app.inject({ method: "POST", url: `/api/admin/trash/job-offers/${offerId}/restore` });

    expect(restored.statusCode).toBe(200);
    expect(purges()).toEqual([sponsor.slug, sponsor.slug, sponsor.slug, sponsor.slug]);
  });
});

// #633 — a published speaker was missing from their own talk's page for an
// hour: speaker writes purged the speaker lists, never the pages that show the
// speaker through their participation — talks, the sponsor of that year, the
// edition's archive. And the other way round for a talk's speakers.
describe("speaker and talk writes purge every page that shows them (#633)", () => {
  const adminSpeakerRoutes = async () => (await import("../routes/admin/speakers.js")).default;
  const createdSpeakerIds: number[] = [];

  afterAll(async () => {
    await prisma.speaker.deleteMany({ where: { id: { in: createdSpeakerIds } } });
  });

  async function fixture() {
    const edition = await getSeededEdition();
    const tier = await prisma.sponsorTier.findFirstOrThrow();
    const { createSponsorFixture } = await import("./sponsor-test-helpers.js");
    const sponsor = await createSponsorFixture({ name: `Footprint ${uniq()}`, slug: `footprint-${uniq()}`, editionId: edition.id, tierId: tier.id });
    createdSponsorIds.push(sponsor.id);
    const speaker = await prisma.speaker.create({
      data: {
        slug: `footprint-speaker-${uniq()}`,
        name: "Footprint Speaker",
        editions: { create: { editionId: edition.id, publicationStatus: "DRAFT", sponsorId: sponsor.id } },
      },
    });
    createdSpeakerIds.push(speaker.id);
    const talk = await prisma.talk.create({
      data: {
        slug: `footprint-talk-${uniq()}`,
        title: "Footprint",
        description: "",
        format: "CONFERENCE",
        language: "fr",
        editionId: edition.id,
        publicationStatus: "DRAFT",
        speakers: { connect: { id: speaker.id } },
      },
    });
    createdTalkIds.push(talk.id);
    return { edition, sponsor, speaker, talk };
  }

  it("should purge the speaker's talks, sponsor and edition when their participation is published", async () => {
    const { edition, sponsor, speaker, talk } = await fixture();
    const app = await buildApp(async (a) => {
      await a.register(await adminSpeakerRoutes(), { prefix: "/api/admin" });
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/speakers/${speaker.id}/editions`,
      payload: { editionId: edition.id, publicationStatus: "PUBLISHED" },
    });

    expect(res.statusCode).toBe(200);
    expect(purgedPaths()).toEqual(
      expect.arrayContaining([
        ...talkPages(talk.slug, edition.year),
        `/fr/sponsors/${sponsor.slug}`,
        `/fr/editions/${edition.year}`,
        `/fr/speakers/${speaker.slug}`,
        "/fr/programme",
      ]),
    );
    await app.close();
  });

  it("should still purge the sponsor of a year the speaker is detached from", async () => {
    const { edition, sponsor, speaker } = await fixture();
    const app = await buildApp(async (a) => {
      await a.register(await adminSpeakerRoutes(), { prefix: "/api/admin" });
    });

    await app.inject({ method: "DELETE", url: `/api/admin/speakers/${speaker.id}/editions/${edition.id}` });

    expect(purgedPaths()).toEqual(expect.arrayContaining([`/fr/sponsors/${sponsor.slug}`, `/fr/editions/${edition.year}`]));
    await app.close();
  });

  it("should purge the page of a speaker taken off a talk", async () => {
    const { speaker, talk } = await fixture();
    const app = await buildApp(async (a) => {
      await a.register(adminTalkRoutes, { prefix: "/api/admin" });
    });

    await app.inject({ method: "PUT", url: `/api/admin/talks/${talk.id}`, payload: { speakerIds: [] } });

    expect(purgedPaths()).toContain(`/fr/speakers/${speaker.slug}`);
    await app.close();
  });

  it("should put a restored speaker back on their talks' pages", async () => {
    const { edition, speaker, talk } = await fixture();
    const adminTrashRoutes = (await import("../routes/admin/trash.js")).default;
    const app = await buildApp(async (a) => {
      await a.register(await adminSpeakerRoutes(), { prefix: "/api/admin" });
      await a.register(adminTrashRoutes, { prefix: "/api/admin" });
    });
    await app.inject({ method: "DELETE", url: `/api/admin/speakers/${speaker.id}` });
    vi.mocked(revalidatePaths).mockClear();

    const restored = await app.inject({ method: "POST", url: `/api/admin/trash/speakers/${speaker.id}/restore` });

    expect(restored.statusCode).toBe(200);
    expect(purgedPaths()).toEqual(expect.arrayContaining([...talkPages(talk.slug, edition.year), `/fr/speakers/${speaker.slug}`]));
    await app.close();
  });
});
