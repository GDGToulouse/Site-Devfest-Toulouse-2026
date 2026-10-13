process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";
process.env.LOG_LEVEL = "silent";

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";

// #609 — the team manages sponsors' job offers from the back-office, as any
// other record: ADMIN and EDITOR, past the tier quota, through the trash. The
// auth context is stubbed and the real server built, so the guards and the
// public reads tested are the ones the server registers.
const authContext = vi.hoisted(() => ({
  current: { user: { id: "test-editor", email: "editor@test.local", name: "Ed", role: "EDITOR" } },
}));

vi.mock("../lib/auth-context.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/auth-context.js")>()),
  getAuthContext: async () => authContext.current,
}));

const { buildServer } = await import("../server.js");
const { prisma } = await import("../lib/prisma.js");
const { getSeededEdition } = await import("./edition-test-helpers.js");
const { createSponsorFixture, tierIdByKey } = await import("./sponsor-test-helpers.js");

let app: FastifyInstance;
let editionId: number;
const createdSponsorIds: number[] = [];

const OFFER = { title: "Architecte Cloud (F/H/NB)", url: "https://jobs.example.org/1" };

// discovery = 1 offer, so a second one is already past the quota.
async function createSponsor(name: string) {
  const suffix = `${Date.now()}-${Math.round(performance.now())}`;
  const sponsor = await createSponsorFixture({
    name: `${name} ${suffix}`,
    slug: `${name.toLowerCase().replace(/\W+/g, "-")}-${suffix}`,
    editionId,
    tierId: await tierIdByKey("discovery"),
    publicationStatus: "PUBLISHED",
  });
  createdSponsorIds.push(sponsor.id);
  return sponsor;
}

async function createOffer(sponsorId: number, payload: Record<string, unknown> = OFFER) {
  return app.inject({
    method: "POST",
    url: `/api/admin/sponsors/${sponsorId}/editions/${editionId}/job-offers`,
    payload,
  });
}

beforeAll(async () => {
  editionId = (await getSeededEdition()).id;
  app = await buildServer();
  await app.ready();
});

beforeEach(() => {
  authContext.current.user.role = "EDITOR";
});

afterAll(async () => {
  await app.close();
  await prisma.sponsor.deleteMany({ where: { id: { in: createdSponsorIds } } });
});

describe("Admin job offers (#609)", () => {
  it("should let an EDITOR publish past the tier quota, which still reports the cap", async () => {
    const sponsor = await createSponsor("Over Quota Co");

    const first = await createOffer(sponsor.id);
    const second = await createOffer(sponsor.id, { ...OFFER, title: "Second poste" });
    const list = await app.inject({
      method: "GET",
      url: `/api/admin/sponsors/${sponsor.id}/editions/${editionId}/job-offers`,
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(list.json().quota).toBe(1);
    expect(list.json().offers.map((o: { title: string }) => o.title)).toEqual([OFFER.title, "Second poste"]);
  });

  it("should refuse a SPONSOR account", async () => {
    const sponsor = await createSponsor("Refused Co");
    authContext.current.user.role = "SPONSOR";

    const res = await createOffer(sponsor.id);

    expect(res.statusCode).toBe(403);
  });

  it("should sanitize descriptions and reject an unsafe URL, like the sponsor space", async () => {
    const sponsor = await createSponsor("Sanitize Co");
    const created = (await createOffer(sponsor.id)).json();

    const updated = await app.inject({
      method: "PUT",
      url: `/api/admin/job-offers/${created.id}`,
      payload: { descriptionFr: "<p>Poste<script>alert(1)</script></p>" },
    });
    const unsafe = await app.inject({
      method: "PUT",
      url: `/api/admin/job-offers/${created.id}`,
      // eslint-disable-next-line no-script-url
      payload: { url: "javascript:alert(1)" },
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json().descriptionFr).toBe("<p>Poste</p>");
    expect(unsafe.statusCode).toBe(400);
    expect(unsafe.json().error).toBe("invalid_url");
  });

  it("should answer 404 when the sponsor does not take part in the edition", async () => {
    const sponsor = await createSponsor("No Participation Co");

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/sponsors/${sponsor.id}/editions/999999/job-offers`,
      payload: OFFER,
    });

    expect(res.statusCode).toBe(404);
  });

  it("should send a deleted offer to the trash, off the public page, and bring it back on restore", async () => {
    const sponsor = await createSponsor("Trash Offer Co");
    const created = (await createOffer(sponsor.id)).json();
    const publicOffers = async () =>
      (await app.inject({ method: "GET", url: `/api/sponsors/${sponsor.slug}` })).json().jobOffers.map((o: { id: number }) => o.id);

    const before = await publicOffers();
    const del = await app.inject({ method: "DELETE", url: `/api/admin/job-offers/${created.id}` });
    const afterDelete = await publicOffers();
    const trash = await app.inject({ method: "GET", url: "/api/admin/trash/job-offers" });
    const restore = await app.inject({ method: "POST", url: `/api/admin/trash/job-offers/${created.id}/restore` });
    const afterRestore = await publicOffers();

    expect(before).toEqual([created.id]);
    expect(del.statusCode).toBe(204);
    expect(afterDelete).toEqual([]);
    expect(trash.json().items.map((i: { id: number }) => i.id)).toContain(created.id);
    expect(restore.statusCode).toBe(200);
    expect(afterRestore).toEqual([created.id]);
  });

  it("should not count a trashed offer in the sponsors list", async () => {
    const sponsor = await createSponsor("Count Offer Co");
    const kept = (await createOffer(sponsor.id)).json();
    const trashed = (await createOffer(sponsor.id, { ...OFFER, title: "À retirer" })).json();
    await app.inject({ method: "DELETE", url: `/api/admin/job-offers/${trashed.id}` });

    const res = await app.inject({ method: "GET", url: `/api/admin/sponsors?editionId=${editionId}` });
    const row = res.json().find((s: { id: number }) => s.id === sponsor.id);

    expect(kept.id).toBeDefined();
    expect(row.jobOfferCount).toBe(1);
  });

  it("should list offers across sponsors, paginated and filtered by sponsor and search", async () => {
    const sponsor = await createSponsor("Listed Offers Co");
    await createOffer(sponsor.id, { ...OFFER, title: "Développeuse Rust" });
    await createOffer(sponsor.id, { ...OFFER, title: "Product Owner" });

    const bySponsor = await app.inject({
      method: "GET",
      url: `/api/admin/job-offers?editionId=${editionId}&sponsorId=${sponsor.id}&page=1&limit=1&sort=title&order=asc`,
    });
    const bySearch = await app.inject({
      method: "GET",
      url: `/api/admin/job-offers?editionId=${editionId}&sponsorId=${sponsor.id}&search=rust`,
    });

    expect(bySponsor.json()).toMatchObject({ page: 1, limit: 1, total: 2 });
    expect(bySponsor.json().items).toEqual([
      expect.objectContaining({ title: "Développeuse Rust", sponsor: { id: sponsor.id, name: sponsor.name } }),
    ]);
    expect(bySearch.json().map((o: { title: string }) => o.title)).toEqual(["Développeuse Rust"]);
  });
});
