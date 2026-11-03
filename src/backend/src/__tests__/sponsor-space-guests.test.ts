process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import sponsorSpaceGuestRoutes from "../routes/sponsor-space-guests.js";
import { prisma } from "../lib/prisma.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { createSponsorFixture } from "./sponsor-test-helpers.js";

// #728, #729 — a sponsor registers its guests from its space, within its places
// and before the deadline (docs/specs/inscriptions-sponsors.md). Authenticated
// through the API-key path like sponsor-space-job-offers.test.ts.
//
// The space works on the featured edition, which other files read too: this
// file only touches its guest-registration columns, and puts them back. The
// places come from a tier of its own, so a suite editing the seeded offers
// cannot change the quota under it.

let app: FastifyInstance;
let editionId: number;
let tierId: number;
let savedRegistration: { isSponsorGuestRegistrationOpen: boolean; sponsorGuestRegistrationOpenedAt: Date | null; sponsorGuestDeadline: Date | null };

const PLACES = 2;
const created = { userIds: [] as string[], sponsorIds: [] as number[] };

const GUEST = {
  lastName: "Durand",
  firstName: "Léa",
  email: "lea.durand@example.org",
  gender: "FEMALE",
  experience: "FROM_3_TO_7_YEARS",
  attendsAfterParty: true,
  diet: "VEGAN",
  needsAssistance: false,
};

const HEADER = "Nom;Prénom;E-mail;Genre;Expérience professionnelle;After;Régime;Assistance";

function suffix() {
  return `${Date.now()}-${Math.round(performance.now() * 1000)}`;
}

async function createAccount(email: string, role: "SPONSOR" | "ADMIN" = "SPONSOR") {
  const user = await prisma.user.create({ data: { email, name: email, role, emailVerified: true } });
  created.userIds.push(user.id);
  const key = await generateApiKey(resolveApiKeyEnv());
  await prisma.apiKey.create({
    data: { name: `test-${email}`, prefix: key.prefix, hashedKey: key.hashedKey, userId: user.id },
  });
  return { user, headers: { authorization: `Bearer ${key.raw}` } };
}

async function createSpace(accessRole: "RESPONSABLE" | "EDITEUR" | "STAND") {
  const s = suffix();
  const sponsor = await createSponsorFixture({ name: `Guest Co ${s}`, slug: `guest-co-${s}`, editionId, tierId });
  created.sponsorIds.push(sponsor.id);
  const { user, headers } = await createAccount(`guests-${s}@example.org`);
  await prisma.sponsorContact.create({ data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole } });
  return { sponsor, headers };
}

async function setRegistration(data: { isSponsorGuestRegistrationOpen?: boolean; sponsorGuestRegistrationOpenedAt?: Date | null; sponsorGuestDeadline?: Date | null }) {
  await prisma.edition.update({ where: { id: editionId }, data });
}

function addGuest(sponsorId: number, headers: Record<string, string>, payload: Record<string, unknown> = GUEST) {
  return app.inject({ method: "POST", url: `/api/sponsor-space/${sponsorId}/guests`, headers, payload });
}

function csv(lines: string[]) {
  return Buffer.from(`${HEADER}\n${lines.join("\n")}\n`, "utf-8").toString("base64");
}

beforeAll(async () => {
  const edition = await getSeededEdition();
  editionId = edition.id;
  savedRegistration = {
    isSponsorGuestRegistrationOpen: edition.isSponsorGuestRegistrationOpen,
    sponsorGuestRegistrationOpenedAt: edition.sponsorGuestRegistrationOpenedAt,
    sponsorGuestDeadline: edition.sponsorGuestDeadline,
  };
  const tier = await prisma.sponsorTier.create({
    data: { key: `guests-test-${suffix()}`, nameFr: "Test invités", nameEn: "Guests test" },
  });
  tierId = tier.id;
  await prisma.editionSponsorTier.create({ data: { editionId, tierId, guestPlaces: PLACES, isVisible: false } });

  app = Fastify({ logger: false });
  app.decorateRequest("authContext");
  app.decorateRequest("sponsorAccess");
  await app.register(sponsorSpaceGuestRoutes, { prefix: "/api" });
  await app.ready();
});

beforeEach(async () => {
  await setRegistration({
    isSponsorGuestRegistrationOpen: true,
    sponsorGuestRegistrationOpenedAt: new Date(),
    sponsorGuestDeadline: new Date(Date.now() + 86_400_000),
  });
});

afterAll(async () => {
  await app.close();
  await setRegistration(savedRegistration);
  if (created.userIds.length) {
    await prisma.apiKey.deleteMany({ where: { userId: { in: created.userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  }
  if (created.sponsorIds.length) await prisma.sponsor.deleteMany({ where: { id: { in: created.sponsorIds } } });
  if (tierId !== undefined) await prisma.sponsorTier.delete({ where: { id: tierId } });
});

describe("Sponsor space guests — opening (RG-INS-28)", () => {
  it("should hide the guests while registration has never been opened", async () => {
    const { sponsor, headers } = await createSpace("RESPONSABLE");
    await setRegistration({ isSponsorGuestRegistrationOpen: false, sponsorGuestRegistrationOpenedAt: null });

    const res = await app.inject({ method: "GET", url: `/api/sponsor-space/${sponsor.id}/guests`, headers });

    expect(res.statusCode).toBe(200);
    expect(res.json().registration).toMatchObject({ isOpen: false, hasEverOpened: false, canWrite: false });
    expect(res.json().guests).toBeUndefined();
  });

  it("should show the guests read-only once closed again", async () => {
    const { sponsor, headers } = await createSpace("RESPONSABLE");
    await addGuest(sponsor.id, headers);
    await setRegistration({ isSponsorGuestRegistrationOpen: false });

    const list = await app.inject({ method: "GET", url: `/api/sponsor-space/${sponsor.id}/guests`, headers });
    const add = await addGuest(sponsor.id, headers, { ...GUEST, email: "late@example.org" });

    expect(list.json().registration.canWrite).toBe(false);
    expect(list.json().guests).toHaveLength(1);
    expect(add.statusCode).toBe(409);
    expect(add.json().error).toBe("registration_closed");
  });

  it("should refuse sponsors after the deadline", async () => {
    const { sponsor, headers } = await createSpace("EDITEUR");
    await setRegistration({ sponsorGuestDeadline: new Date(Date.now() - 60_000) });

    const res = await addGuest(sponsor.id, headers);

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("registration_closed");
  });
});

describe("Sponsor space guests — quota (RG-INS-13, RG-INS-14)", () => {
  it("should register up to the offer's places and refuse the next one", async () => {
    const { sponsor, headers } = await createSpace("EDITEUR");

    const first = await addGuest(sponsor.id, headers);
    const second = await addGuest(sponsor.id, headers, { ...GUEST, email: "second@example.org" });
    const third = await addGuest(sponsor.id, headers, { ...GUEST, email: "third@example.org" });
    const list = await app.inject({ method: "GET", url: `/api/sponsor-space/${sponsor.id}/guests`, headers });

    expect([first.statusCode, second.statusCode]).toEqual([201, 201]);
    expect(third.statusCode).toBe(409);
    expect(third.json()).toMatchObject({ error: "quota_reached", remaining: 0 });
    expect(list.json()).toMatchObject({ quota: PLACES, registeredCount: 2, remaining: 0, outOfQuotaCount: 0 });
  });

  it("should give the last place to one of several simultaneous requests only", async () => {
    const { sponsor, headers } = await createSpace("EDITEUR");
    await addGuest(sponsor.id, headers);

    // Six at once: with two, the race rarely opens and the test passed
    // without the row lock too.
    const results = await Promise.all(
      ["a", "b", "c", "d", "e", "f"].map((name) => addGuest(sponsor.id, headers, { ...GUEST, email: `${name}@example.org` })),
    );

    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409, 409, 409, 409, 409]);
    expect(await prisma.sponsorGuest.count({ where: { editionSponsor: { sponsorId: sponsor.id } } })).toBe(PLACES);
  });

  it("should mark the last guests out of quota when places are taken back, and back in when restored", async () => {
    const { sponsor, headers } = await createSpace("EDITEUR");
    await addGuest(sponsor.id, headers);
    await addGuest(sponsor.id, headers, { ...GUEST, email: "second@example.org" });
    const participation = await prisma.editionSponsor.findFirstOrThrow({ where: { sponsorId: sponsor.id } });
    const cut = await prisma.sponsorGuestAdjustment.create({
      data: { editionSponsorId: participation.id, quantity: -1, reason: "CORRECTION" },
    });

    const lowered = await app.inject({ method: "GET", url: `/api/sponsor-space/${sponsor.id}/guests`, headers });
    await prisma.sponsorGuestAdjustment.delete({ where: { id: cut.id } });
    const restored = await app.inject({ method: "GET", url: `/api/sponsor-space/${sponsor.id}/guests`, headers });

    expect(lowered.json().guests.map((g: { email: string; isWithinQuota: boolean }) => [g.email, g.isWithinQuota])).toEqual([
      [GUEST.email, true],
      ["second@example.org", false],
    ]);
    expect(restored.json().outOfQuotaCount).toBe(0);
  });

  it("should accept the same address twice and flag both (RG-INS-25)", async () => {
    const { sponsor, headers } = await createSpace("EDITEUR");
    await addGuest(sponsor.id, headers);
    const again = await addGuest(sponsor.id, headers, { ...GUEST, email: GUEST.email.toUpperCase() });

    const list = await app.inject({ method: "GET", url: `/api/sponsor-space/${sponsor.id}/guests`, headers });

    expect(again.statusCode).toBe(201);
    expect(list.json().guests.map((g: { hasDuplicateEmail: boolean }) => g.hasDuplicateEmail)).toEqual([true, true]);
  });
});

describe("Sponsor space guests — rights (RG-INS-22, RG-INS-27)", () => {
  it("should let STAND read but not write", async () => {
    const { sponsor, headers } = await createSpace("STAND");

    const read = await app.inject({ method: "GET", url: `/api/sponsor-space/${sponsor.id}/guests`, headers });
    const write = await addGuest(sponsor.id, headers);

    expect(read.statusCode).toBe(200);
    expect(read.json().registration.canWrite).toBe(false);
    expect(write.statusCode).toBe(403);
  });

  it("should keep a guest with a ticket out of reach", async () => {
    const { sponsor, headers } = await createSpace("RESPONSABLE");
    const { id } = (await addGuest(sponsor.id, headers)).json();
    await prisma.sponsorGuest.update({ where: { id }, data: { billetwebTicketId: `T-${suffix()}` } });

    const edit = await app.inject({ method: "PUT", url: `/api/sponsor-space/${sponsor.id}/guests/${id}`, headers, payload: { ...GUEST, firstName: "Autre" } });
    const remove = await app.inject({ method: "DELETE", url: `/api/sponsor-space/${sponsor.id}/guests/${id}`, headers });
    const list = await app.inject({ method: "GET", url: `/api/sponsor-space/${sponsor.id}/guests`, headers });

    expect(edit.statusCode).toBe(409);
    expect(remove.statusCode).toBe(409);
    expect(list.json().guests[0].hasTicket).toBe(true);
  });

  it("should not reach another sponsor's guest", async () => {
    const mine = await createSpace("RESPONSABLE");
    const theirs = await createSpace("RESPONSABLE");
    const { id } = (await addGuest(theirs.sponsor.id, theirs.headers)).json();

    const res = await app.inject({ method: "DELETE", url: `/api/sponsor-space/${mine.sponsor.id}/guests/${id}`, headers: mine.headers });

    expect(res.statusCode).toBe(404);
    expect(await prisma.sponsorGuest.count({ where: { id } })).toBe(1);
  });

  it("should edit and delete a guest without a ticket", async () => {
    const { sponsor, headers } = await createSpace("EDITEUR");
    const { id } = (await addGuest(sponsor.id, headers)).json();

    const edit = await app.inject({ method: "PUT", url: `/api/sponsor-space/${sponsor.id}/guests/${id}`, headers, payload: { ...GUEST, firstName: "  Léonie " } });
    const stored = await prisma.sponsorGuest.findUniqueOrThrow({ where: { id } });
    const remove = await app.inject({ method: "DELETE", url: `/api/sponsor-space/${sponsor.id}/guests/${id}`, headers });

    expect(edit.statusCode).toBe(200);
    expect(stored.firstName).toBe("Léonie");
    expect(remove.statusCode).toBe(204);
  });

  it("should let an admin past the deadline and the quota, as the team", async () => {
    const { sponsor } = await createSpace("STAND");
    const admin = await createAccount(`admin-guests-${suffix()}@example.org`, "ADMIN");
    await setRegistration({ sponsorGuestDeadline: new Date(Date.now() - 60_000) });

    const results = [];
    for (const email of ["1@example.org", "2@example.org", "3@example.org"]) {
      results.push((await addGuest(sponsor.id, admin.headers, { ...GUEST, email })).statusCode);
    }
    const list = await app.inject({ method: "GET", url: `/api/sponsor-space/${sponsor.id}/guests`, headers: admin.headers });

    expect(results).toEqual([201, 201, 201]);
    expect(list.json().outOfQuotaCount).toBe(1);
  });
});

describe("Sponsor space guests — CSV import (RG-INS-33, RG-INS-34)", () => {
  it("should preview without writing, then import on confirmation", async () => {
    const { sponsor, headers } = await createSpace("EDITEUR");
    const file = csv(["Martin;Paul;paul@example.org;Homme;Etudiant;oui;;non"]);

    const preview = await app.inject({ method: "POST", url: `/api/sponsor-space/${sponsor.id}/guests/import`, headers, payload: { file } });
    const countAfterPreview = await prisma.sponsorGuest.count({ where: { editionSponsor: { sponsorId: sponsor.id } } });
    const confirmed = await app.inject({ method: "POST", url: `/api/sponsor-space/${sponsor.id}/guests/import`, headers, payload: { file, confirm: true } });

    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({ count: 1, remaining: PLACES, excess: 0 });
    expect(countAfterPreview).toBe(0);
    expect(confirmed.statusCode).toBe(201);
    expect(confirmed.json()).toEqual({ created: 1 });
  });

  it("should refuse a whole batch that does not fit in the remaining places", async () => {
    const { sponsor, headers } = await createSpace("EDITEUR");
    await addGuest(sponsor.id, headers);
    const file = csv([
      "Martin;Paul;paul@example.org;Homme;Etudiant;oui;;non",
      "Petit;Zoé;zoe@example.org;Femme;Etudiant;non;;non",
    ]);

    const preview = await app.inject({ method: "POST", url: `/api/sponsor-space/${sponsor.id}/guests/import`, headers, payload: { file } });
    const confirmed = await app.inject({ method: "POST", url: `/api/sponsor-space/${sponsor.id}/guests/import`, headers, payload: { file, confirm: true } });

    expect(preview.json()).toMatchObject({ count: 2, remaining: 1, excess: 1 });
    expect(confirmed.statusCode).toBe(409);
    expect(await prisma.sponsorGuest.count({ where: { editionSponsor: { sponsorId: sponsor.id } } })).toBe(1);
  });

  it("should report the faulty lines and import nothing", async () => {
    const { sponsor, headers } = await createSpace("EDITEUR");
    const file = csv(["Martin;Paul;paul@example.org;Homme;Etudiant;oui;;non", "Petit;Zoé;zoe@example.org;Chat;Etudiant;non;;non"]);

    const res = await app.inject({ method: "POST", url: `/api/sponsor-space/${sponsor.id}/guests/import`, headers, payload: { file, confirm: true } });

    expect(res.statusCode).toBe(422);
    expect(res.json().lines).toEqual([{ line: 3, message: "genre « Chat » inconnu" }]);
    expect(await prisma.sponsorGuest.count({ where: { editionSponsor: { sponsorId: sponsor.id } } })).toBe(0);
  });

  it("should serve the template to an editor", async () => {
    const { sponsor, headers } = await createSpace("EDITEUR");

    const res = await app.inject({ method: "GET", url: `/api/sponsor-space/${sponsor.id}/guests/template`, headers });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.body.startsWith("﻿Nom;Prénom;E-mail")).toBe(true);
  });
});
