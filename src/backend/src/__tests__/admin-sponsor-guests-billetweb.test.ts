process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";
process.env.LOG_LEVEL = "silent";

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";

// #731, #732 — sponsor guests become Billetweb tickets. Billetweb is replaced
// by a fake answering the shapes of its OpenAPI description; what is checked
// is what the site sends, and what it keeps of the answers.
const authContext = vi.hoisted(() => ({
  current: { user: { id: "bw-admin", email: "bw-admin@test.local", name: "Bea", role: "ADMIN" } },
}));

vi.mock("../lib/auth-context.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/auth-context.js")>()),
  getAuthContext: async () => authContext.current,
}));

const { buildServer } = await import("../server.js");
const { prisma } = await import("../lib/prisma.js");
const { createSponsorFixture } = await import("./sponsor-test-helpers.js");

// This file's edition (test-year-ownership.test.ts).
const TEST_YEAR = 1734;
const EVENT_ID = "990001";
const TICKET_ID = "4242";

// Ids of the ticket-form questions, as /api/event/{id}/forms gives them.
const FIELDS = {
  gender: { id: 11, name: "Genre", answers: ["Femme", "Homme", "Non spécifié"] },
  experience: { id: 12, name: "Expérience professionnelle", answers: ["Etudiant", "Inf. à 3 ans", "Entre 3 et 7 ans", "Sup à 7 ans"] },
  after: { id: 13, name: "Je participe à l'after (à partir de 18h00)" },
  diet: { id: 14, name: "Je souhaite un régime particulier", answers: ["Végétarien", "Végan", "Autre (je précise par mail)"] },
  assistance: { id: 15, name: "J'ai besoin d'une assistance particulière pendant l'événement ?" },
  company: { id: 16, name: "Entreprise" },
  origin: { id: 21, name: "Origine" },
};

interface FakeState {
  attendees: Array<Record<string, unknown>>;
  addOrderBodies: Array<{ data: Array<Record<string, unknown>> }>;
  deleteOrderBodies: Array<{ data: number[] }>;
  addOrderStatus: number;
  formFields: Array<{ id: number; name: string }>;
}

let fake: FakeState;
// Across tests, as Billetweb never hands out an id twice: the ticket id is
// unique on the guest.
let nextId = 700000;

function resetFake() {
  fake = {
    attendees: [],
    addOrderBodies: [],
    deleteOrderBodies: [],
    addOrderStatus: 200,
    formFields: [FIELDS.gender, FIELDS.experience, FIELDS.after, FIELDS.diet, FIELDS.assistance, FIELDS.company],
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// The fake Billetweb: only the routes the sync uses.
async function fakeBilletweb(input: string | URL | Request, init?: RequestInit) {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  expect(url.searchParams.get("key")).toBe("test-key");
  const path = url.pathname.replace(/^\/api/, "");
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;

  if (path === "/fields") return json(Object.values(FIELDS));
  if (path === `/event/${EVENT_ID}/forms`) {
    return json([{ id: 0, default: 1, tickets: [Number(TICKET_ID)], ticket_fields: fake.formFields, buyer_fields: [FIELDS.origin] }]);
  }
  if (path === `/event/${EVENT_ID}/tickets`) return json([{ id: TICKET_ID, name: "Sponsors", full_name: "Invitations > Sponsors" }]);
  if (path === `/event/${EVENT_ID}/attendees`) {
    const productId = url.searchParams.get("product_id");
    const extId = url.searchParams.get("ext_id");
    return json(fake.attendees.filter((a) => (!productId || a.id === productId) && (!extId || a.ext_id === extId)));
  }
  if (path === `/event/${EVENT_ID}/add_order`) {
    fake.addOrderBodies.push(body);
    if (fake.addOrderStatus !== 200) return new Response("Tarif inconnu", { status: fake.addOrderStatus });
    return json(
      body.data.map((order: { request_id: string; products: Array<{ request_id: string }> }) => {
        const orderId = String(nextId++);
        const productId = String(nextId++);
        return {
          id: orderId,
          request_id: order.request_id,
          products: [productId],
          products_details: [{ id: productId, ext_id: `T-${productId}`, request_id: order.products[0].request_id }],
        };
      }),
    );
  }
  if (path === `/event/${EVENT_ID}/delete_order`) {
    fake.deleteOrderBodies.push(body);
    return json({ success: true });
  }
  return new Response("not found", { status: 404 });
}

let app: FastifyInstance;
let editionId: number;
let tierId: number;
const createdSponsorIds: number[] = [];

const GUEST = {
  lastName: "Lambert",
  firstName: "Chloé",
  email: "chloe.lambert@example.org",
  gender: "FEMALE" as const,
  experience: "OVER_7_YEARS" as const,
  attendsAfterParty: true,
  diet: "NONE" as const,
  needsAssistance: false,
};

async function createSponsorWithGuests(count: number) {
  const suffix = `${Date.now()}-${Math.round(performance.now() * 1000)}`;
  const sponsor = await createSponsorFixture({ name: `Billetweb Co ${suffix}`, slug: `billetweb-co-${suffix}`, editionId, tierId });
  createdSponsorIds.push(sponsor.id);
  const participation = await prisma.editionSponsor.findFirstOrThrow({ where: { sponsorId: sponsor.id } });
  const guests = [];
  for (let i = 0; i < count; i++) {
    guests.push(
      await prisma.sponsorGuest.create({
        data: { ...GUEST, email: `guest${i}-${suffix}@example.org`, editionSponsorId: participation.id },
      }),
    );
  }
  return { sponsor, guests };
}

function sync(sponsorId: number) {
  return app.inject({ method: "POST", url: `/api/admin/editions/${editionId}/sponsor-guests/billetweb/sync`, payload: { sponsorId } });
}

beforeAll(async () => {
  process.env.BILLETWEB_USER = "test-user";
  process.env.BILLETWEB_KEY = "test-key";
  const edition = await prisma.edition.create({
    data: {
      year: TEST_YEAR,
      sponsorGuestBilletwebEventId: EVENT_ID,
      sponsorGuestBilletwebTicketId: TICKET_ID,
      sponsorGuestBilletwebTicketName: "Sponsors",
    },
  });
  editionId = edition.id;
  const tier = await prisma.sponsorTier.create({
    data: { key: `billetweb-guests-test-${Date.now()}`, nameFr: "Test Billetweb", nameEn: "Billetweb test" },
  });
  tierId = tier.id;
  // Two places: a third guest is out of quota.
  await prisma.editionSponsorTier.create({ data: { editionId, tierId, guestPlaces: 2 } });

  app = await buildServer();
  await app.ready();
});

beforeEach(() => {
  resetFake();
  vi.stubGlobal("fetch", vi.fn(fakeBilletweb));
  authContext.current.user.role = "ADMIN";
});

afterAll(async () => {
  vi.unstubAllGlobals();
  delete process.env.BILLETWEB_USER;
  delete process.env.BILLETWEB_KEY;
  await app.close();
  if (createdSponsorIds.length) await prisma.sponsor.deleteMany({ where: { id: { in: createdSponsorIds } } });
  if (editionId !== undefined) await prisma.edition.delete({ where: { id: editionId } });
  if (tierId !== undefined) await prisma.sponsorTier.delete({ where: { id: tierId } });
});

describe("Billetweb sync — creating tickets (RG-INS-40 to RG-INS-43)", () => {
  it("should create one order per guest within the quota, marked as coming from the site", async () => {
    const { sponsor, guests } = await createSponsorWithGuests(3);

    const res = await sync(sponsor.id);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ created: 2, adopted: 0, failed: 0, blockedOutOfQuota: 1, missingOptionalFields: [] });
    const orders = fake.addOrderBodies[0].data;
    expect(orders).toHaveLength(2);
    expect(orders[0]).toMatchObject({
      request_id: `site-sponsor-${guests[0].id}`,
      payment_type: "invitation",
      ship: 1,
      name: "Lambert",
      email: guests[0].email,
      custom: { [FIELDS.origin.id]: `Site — ${sponsor.name}` },
      products: [
        {
          ticket: TICKET_ID,
          reference: `site-sponsor-${guests[0].id}`,
          custom: {
            [FIELDS.gender.id]: "Femme",
            [FIELDS.experience.id]: "Sup à 7 ans",
            [FIELDS.after.id]: "1",
            [FIELDS.diet.id]: "",
            [FIELDS.assistance.id]: "",
            [FIELDS.company.id]: sponsor.name,
          },
        },
      ],
    });
  });

  it("should keep the ticket number and never send the guest again", async () => {
    const { sponsor, guests } = await createSponsorWithGuests(1);

    await sync(sponsor.id);
    const second = await sync(sponsor.id);
    const stored = await prisma.sponsorGuest.findUniqueOrThrow({ where: { id: guests[0].id } });

    expect(second.json()).toMatchObject({ created: 0 });
    expect(fake.addOrderBodies).toHaveLength(1);
    expect(stored.billetwebTicketId).not.toBeNull();
    expect(stored.billetwebTicketRef).toBe(`T-${stored.billetwebTicketId}`);
    expect(stored.billetwebOrderId).not.toBeNull();
  });

  it("should link a ticket Billetweb already holds for the guest instead of creating a second one", async () => {
    const { sponsor, guests } = await createSponsorWithGuests(1);
    fake.attendees.push({
      id: "555001",
      ext_id: "T-555001",
      order_id: "555000",
      ticket_id: TICKET_ID,
      name: "LAMBERT",
      firstname: "Chloé",
      email: guests[0].email.toUpperCase(),
      disabled: "0",
      custom: {},
    });

    const res = await sync(sponsor.id);
    const stored = await prisma.sponsorGuest.findUniqueOrThrow({ where: { id: guests[0].id } });

    expect(res.json()).toMatchObject({ created: 0, adopted: 1 });
    expect(fake.addOrderBodies).toHaveLength(0);
    expect(stored.billetwebTicketId).toBe("555001");
  });

  it("should mark the guests of a refused batch and leave them to the next sync", async () => {
    const { sponsor, guests } = await createSponsorWithGuests(1);
    fake.addOrderStatus = 400;

    const res = await sync(sponsor.id);
    const stored = await prisma.sponsorGuest.findUniqueOrThrow({ where: { id: guests[0].id } });

    expect(res.json()).toMatchObject({ created: 0, failed: 1 });
    expect(stored.billetwebTicketId).toBeNull();
    expect(stored.billetwebError).toContain("Tarif inconnu");
  });

  it("should refuse to sync when a question is missing from the Billetweb form", async () => {
    const { sponsor } = await createSponsorWithGuests(1);
    fake.formFields = [FIELDS.gender, FIELDS.experience];

    const res = await sync(sponsor.id);

    expect(res.statusCode).toBe(502);
    expect(res.json().message).toContain("after, regime, assistance");
    expect(fake.addOrderBodies).toHaveLength(0);
  });

  it("should be an ADMIN's action", async () => {
    const { sponsor } = await createSponsorWithGuests(1);
    authContext.current.user.role = "EDITOR";

    const res = await sync(sponsor.id);

    expect(res.statusCode).toBe(403);
  });
});

describe("Billetweb sync — reading back (RG-INS-48)", () => {
  it("should copy what the guest corrected in Billetweb, and flag a cancelled ticket", async () => {
    const { sponsor, guests } = await createSponsorWithGuests(1);
    await prisma.sponsorGuest.update({ where: { id: guests[0].id }, data: { billetwebTicketId: "555100", billetwebOrderId: "555099" } });
    fake.attendees.push({
      id: "555100",
      ticket_id: TICKET_ID,
      name: "Lambert-Roy",
      firstname: "Chloé",
      email: guests[0].email,
      disabled: "1",
      custom: { [FIELDS.diet.name]: "Végan", [FIELDS.after.name]: "", [FIELDS.experience.name]: "Entre 3 et 7 ans" },
    });

    const res = await sync(sponsor.id);
    const stored = await prisma.sponsorGuest.findUniqueOrThrow({ where: { id: guests[0].id } });

    expect(res.json().refreshed).toBe(1);
    expect(stored).toMatchObject({
      lastName: "Lambert-Roy",
      diet: "VEGAN",
      attendsAfterParty: false,
      experience: "FROM_3_TO_7_YEARS",
      isBilletwebCancelled: true,
    });
  });
});

describe("Billetweb — cancelling a ticket (RG-INS-45)", () => {
  it("should delete the order in Billetweb, then the guest", async () => {
    const { guests } = await createSponsorWithGuests(1);
    await prisma.sponsorGuest.update({ where: { id: guests[0].id }, data: { billetwebTicketId: "555200", billetwebOrderId: "555199" } });

    const res = await app.inject({ method: "POST", url: `/api/admin/sponsor-guests/${guests[0].id}/cancel-ticket` });

    expect(res.statusCode).toBe(204);
    expect(fake.deleteOrderBodies).toEqual([{ data: [555199] }]);
    expect(await prisma.sponsorGuest.count({ where: { id: guests[0].id } })).toBe(0);
  });
});

describe("Billetweb — attaching an existing ticket (#732, RG-INS-49)", () => {
  function attach(sponsorId: number, payload: Record<string, unknown>) {
    return app.inject({ method: "POST", url: `/api/admin/sponsors/${sponsorId}/editions/${editionId}/guests/attach`, payload });
  }

  it("should show whose ticket it is, then attach it read-only to the sponsor", async () => {
    const { sponsor } = await createSponsorWithGuests(0);
    fake.attendees.push({
      id: "555300",
      ext_id: "T356-3899-E1000",
      order_id: "555299",
      ticket_id: TICKET_ID,
      ticket: "Sponsors",
      name: "Morel",
      firstname: "Hugo",
      email: "hugo.morel@example.org",
      disabled: "0",
      custom: { [FIELDS.gender.name]: "Homme", [FIELDS.experience.name]: "Etudiant", [FIELDS.after.name]: "1" },
    });

    const preview = await attach(sponsor.id, { ticket: "T356-3899-E1000" });
    const confirmed = await attach(sponsor.id, { ticket: "T356-3899-E1000", confirm: true });
    const again = await attach(sponsor.id, { ticket: "555300", confirm: true });

    expect(preview.json()).toMatchObject({ lastName: "Morel", gender: "MALE", experience: "STUDENT", attendsAfterParty: true, ticketId: "555300" });
    expect(confirmed.statusCode).toBe(201);
    const stored = await prisma.sponsorGuest.findUniqueOrThrow({ where: { id: confirmed.json().id } });
    expect(stored).toMatchObject({ billetwebTicketId: "555300", billetwebTicketRef: "T356-3899-E1000", billetwebOrderId: "555299" });
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe("ticket_already_attached");
  });

  it("should ask for what the ticket form left empty", async () => {
    const { sponsor } = await createSponsorWithGuests(0);
    fake.attendees.push({ id: "555400", ticket_id: TICKET_ID, name: "Petit", firstname: "Léo", email: "leo@example.org", disabled: "0", custom: {} });

    const missing = await attach(sponsor.id, { ticket: "555400", confirm: true });
    const completed = await attach(sponsor.id, { ticket: "555400", confirm: true, gender: "UNSPECIFIED", experience: "UNDER_3_YEARS" });

    expect(missing.statusCode).toBe(422);
    expect(completed.statusCode).toBe(201);
  });

  it("should refuse a cancelled or unknown ticket", async () => {
    const { sponsor } = await createSponsorWithGuests(0);
    fake.attendees.push({ id: "555500", ticket_id: TICKET_ID, name: "X", firstname: "Y", email: "x@example.org", disabled: "1" });

    const cancelled = await attach(sponsor.id, { ticket: "555500" });
    const unknown = await attach(sponsor.id, { ticket: "999999" });

    expect(cancelled.json().error).toBe("ticket_cancelled");
    expect(unknown.statusCode).toBe(404);
  });
});
