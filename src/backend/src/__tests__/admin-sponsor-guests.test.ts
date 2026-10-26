process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";
process.env.LOG_LEVEL = "silent";

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";

// #727, #730 — the team sets the places, opens registration and manages every
// sponsor's guests, past the quota and the deadline. The auth context is
// stubbed and the real server built, so the guards are the registered ones.
const authContext = vi.hoisted(() => ({
  current: { user: { id: "", email: "guests-admin@test.local", name: "Ada", role: "EDITOR" } },
}));

vi.mock("../lib/auth-context.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/auth-context.js")>()),
  getAuthContext: async () => authContext.current,
}));

const { buildServer } = await import("../server.js");
const { prisma } = await import("../lib/prisma.js");
const { createSponsorFixture } = await import("./sponsor-test-helpers.js");

// This file's edition (test-year-ownership.test.ts).
const TEST_YEAR = 1733;

let app: FastifyInstance;
let editionId: number;
let tierId: number;
let userId: string;
const createdSponsorIds: number[] = [];

const GUEST = {
  lastName: "Roux",
  firstName: "Iris",
  email: "iris.roux@example.org",
  gender: "UNSPECIFIED",
  experience: "STUDENT",
};

async function createSponsor() {
  const suffix = `${Date.now()}-${Math.round(performance.now() * 1000)}`;
  const sponsor = await createSponsorFixture({ name: `Admin Guest Co ${suffix}`, slug: `admin-guest-co-${suffix}`, editionId, tierId });
  createdSponsorIds.push(sponsor.id);
  return sponsor;
}

function addGuest(sponsorId: number, payload: Record<string, unknown> = GUEST) {
  return app.inject({ method: "POST", url: `/api/admin/sponsors/${sponsorId}/editions/${editionId}/guests`, payload });
}

function book(sponsorId: number) {
  return app.inject({ method: "GET", url: `/api/admin/sponsors/${sponsorId}/editions/${editionId}/guests` });
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: `guests-admin-${Date.now()}@test.local`, name: "Ada", role: "ADMIN", emailVerified: true },
  });
  userId = user.id;
  authContext.current.user.id = user.id;

  const edition = await prisma.edition.create({
    data: { year: TEST_YEAR, startDate: new Date("2026-11-19T08:00:00Z") },
  });
  editionId = edition.id;
  const tier = await prisma.sponsorTier.create({
    data: { key: `admin-guests-test-${Date.now()}`, nameFr: "Test admin invités", nameEn: "Admin guests test" },
  });
  tierId = tier.id;
  // Two places, set here rather than by the route test below, so each test
  // stands on its own.
  await prisma.editionSponsorTier.create({ data: { editionId, tierId, guestPlaces: 2 } });

  app = await buildServer();
  await app.ready();
});

beforeEach(() => {
  authContext.current.user.role = "EDITOR";
});

afterAll(async () => {
  await app.close();
  if (createdSponsorIds.length) await prisma.sponsor.deleteMany({ where: { id: { in: createdSponsorIds } } });
  if (editionId !== undefined) await prisma.edition.delete({ where: { id: editionId } });
  if (tierId !== undefined) await prisma.sponsorTier.delete({ where: { id: tierId } });
  if (userId !== undefined) await prisma.user.delete({ where: { id: userId } });
});

describe("Admin sponsor guests — edition settings (RG-INS-10, RG-INS-21, RG-INS-28)", () => {
  it("should start closed, with the Friday before the edition as default deadline", async () => {
    const res = await app.inject({ method: "GET", url: `/api/admin/editions/${editionId}` });

    expect(res.json()).toMatchObject({
      isSponsorGuestRegistrationOpen: false,
      sponsorGuestRegistrationOpenedAt: null,
      sponsorGuestDeadline: null,
      defaultSponsorGuestDeadline: "2026-11-13T22:59:00.000Z",
    });
  });

  it("should remember the first opening when registration closes again", async () => {
    authContext.current.user.role = "ADMIN";
    const put = (payload: Record<string, unknown>) =>
      app.inject({ method: "PUT", url: `/api/admin/editions/${editionId}`, payload });

    await put({ isSponsorGuestRegistrationOpen: true, sponsorGuestDeadline: "2026-11-06T22:59:00.000Z" });
    const opened = (await app.inject({ method: "GET", url: `/api/admin/editions/${editionId}` })).json();
    await put({ isSponsorGuestRegistrationOpen: false, sponsorGuestDeadline: null });
    const closed = (await app.inject({ method: "GET", url: `/api/admin/editions/${editionId}` })).json();

    expect(opened.sponsorGuestDeadline).toBe("2026-11-06T22:59:00.000Z");
    expect(opened.sponsorGuestRegistrationOpenedAt).not.toBeNull();
    expect(closed.isSponsorGuestRegistrationOpen).toBe(false);
    expect(closed.sponsorGuestRegistrationOpenedAt).toBe(opened.sponsorGuestRegistrationOpenedAt);
    expect(closed.sponsorGuestDeadline).toBeNull();
  });

  it("should store the places of an offer for the edition", async () => {
    authContext.current.user.role = "ADMIN";

    const put = await app.inject({
      method: "PUT",
      url: `/api/admin/editions/${editionId}/sponsor-tiers/${tierId}`,
      payload: { guestPlaces: 2 },
    });
    const bad = await app.inject({
      method: "PUT",
      url: `/api/admin/editions/${editionId}/sponsor-tiers/${tierId}`,
      payload: { guestPlaces: -1 },
    });

    expect(put.json().guestPlaces).toBe(2);
    expect(bad.statusCode).toBe(400);
  });
});

describe("Admin sponsor guests — quota and adjustments (RG-INS-11, RG-INS-12)", () => {
  it("should add adjustments to the offer's places, with their author", async () => {
    const sponsor = await createSponsor();

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/sponsors/${sponsor.id}/editions/${editionId}/guest-adjustments`,
      payload: { quantity: 3, reason: "PURCHASED", comment: "  Pack de 3 places  " },
    });
    const body = (await book(sponsor.id)).json();

    expect(res.statusCode).toBe(201);
    expect(body).toMatchObject({ basePlaces: 2, adjustmentTotal: 3, quota: 5 });
    expect(body.adjustments[0]).toMatchObject({ quantity: 3, reason: "PURCHASED", comment: "Pack de 3 places", createdBy: { name: "Ada" } });
  });

  it("should refuse an adjustment of zero", async () => {
    const sponsor = await createSponsor();

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/sponsors/${sponsor.id}/editions/${editionId}/guest-adjustments`,
      payload: { quantity: 0, reason: "CORRECTION" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("should withdraw an adjustment entered by mistake", async () => {
    const sponsor = await createSponsor();
    const { id } = (
      await app.inject({
        method: "POST",
        url: `/api/admin/sponsors/${sponsor.id}/editions/${editionId}/guest-adjustments`,
        payload: { quantity: -1, reason: "CORRECTION" },
      })
    ).json();

    const res = await app.inject({ method: "DELETE", url: `/api/admin/sponsor-guest-adjustments/${id}` });

    expect(res.statusCode).toBe(204);
    expect((await book(sponsor.id)).json().quota).toBe(2);
  });
});

describe("Admin sponsor guests — the team past the rules (RG-INS-15, RG-INS-22)", () => {
  it("should add past the quota and report the guest out of quota in the edition list", async () => {
    const sponsor = await createSponsor();
    for (const email of ["a@example.org", "b@example.org", "c@example.org"]) {
      expect((await addGuest(sponsor.id, { ...GUEST, email })).statusCode).toBe(201);
    }

    const list = await app.inject({
      method: "GET",
      url: `/api/admin/editions/${editionId}/sponsor-guests?sponsorId=${sponsor.id}&filter=outOfQuota&page=1`,
    });

    expect(list.statusCode).toBe(200);
    expect(list.json().total).toBe(1);
    expect(list.json().items[0]).toMatchObject({ email: "c@example.org", isWithinQuota: false, sponsor: { id: sponsor.id } });
    expect(list.json().alerts.outOfQuota).toBeGreaterThanOrEqual(1);
    expect(list.json().sponsors.find((s: { sponsor: { id: number } }) => s.sponsor.id === sponsor.id)).toMatchObject({ quota: 2, registeredCount: 3, outOfQuotaCount: 1 });
  });

  it("should find a guest by name without accents", async () => {
    const sponsor = await createSponsor();
    await addGuest(sponsor.id, { ...GUEST, lastName: "Bérénice-Ünal", email: "berenice@example.org" });

    const list = await app.inject({ method: "GET", url: `/api/admin/editions/${editionId}/sponsor-guests?search=berenice-unal` });

    expect(list.json().items.map((g: { email: string }) => g.email)).toContain("berenice@example.org");
  });

  it("should leave a guest with a ticket alone", async () => {
    const sponsor = await createSponsor();
    const { id } = (await addGuest(sponsor.id)).json();
    await prisma.sponsorGuest.update({ where: { id }, data: { billetwebTicketId: `T-admin-${Date.now()}` } });

    const edit = await app.inject({ method: "PUT", url: `/api/admin/sponsor-guests/${id}`, payload: GUEST });
    const remove = await app.inject({ method: "DELETE", url: `/api/admin/sponsor-guests/${id}` });

    expect(edit.statusCode).toBe(409);
    expect(remove.statusCode).toBe(409);
  });

  it("should import a batch past the quota, saying by how much", async () => {
    const sponsor = await createSponsor();
    const file = Buffer.from(
      "Nom;Prénom;E-mail;Genre;Expérience\nA;B;a@example.org;Femme;Etudiant\nC;D;c@example.org;Homme;Etudiant\nE;F;e@example.org;Homme;Etudiant\n",
    ).toString("base64");
    const url = `/api/admin/sponsors/${sponsor.id}/editions/${editionId}/guests/import`;

    const preview = await app.inject({ method: "POST", url, payload: { file } });
    const confirmed = await app.inject({ method: "POST", url, payload: { file, confirm: true } });

    expect(preview.json()).toMatchObject({ count: 3, remaining: 2, outOfQuota: 1 });
    expect(confirmed.json()).toEqual({ created: 3 });
    expect((await book(sponsor.id)).json().outOfQuotaCount).toBe(1);
  });

  it("should refuse a SPONSOR account", async () => {
    const sponsor = await createSponsor();
    authContext.current.user.role = "SPONSOR";

    const res = await addGuest(sponsor.id);

    expect(res.statusCode).toBe(403);
  });
});
