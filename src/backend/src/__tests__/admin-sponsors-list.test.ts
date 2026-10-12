process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import adminSponsorRoutes from "../routes/admin/sponsors.js";
import { prisma } from "../lib/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { tierIdByKey } from "./sponsor-test-helpers.js";

// #574 — the back-office sponsor list asks the API for one page, filtered on
// the follow-up of the year looked at, and never sends an invitation token.

// Years no other file uses (#292), and a name prefix only these fixtures carry.
const YEAR = 1977;
const PREVIOUS = 1974;
const P = "Zq574";

let app: FastifyInstance;
let editionId: number;
let previousId: number;
const sponsorIds: number[] = [];

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(adminSponsorRoutes, { prefix: "/api/admin" });
  editionId = (await prisma.edition.create({ data: { year: YEAR, status: "SEE_YOU_NEXT_YEAR" } })).id;
  previousId = (await prisma.edition.create({ data: { year: PREVIOUS, status: "SEE_YOU_NEXT_YEAR" } })).id;
  const gold = await tierIdByKey("gold");
  const discovery = await tierIdByKey("discovery");

  const make = async (
    key: string,
    identity: Partial<Prisma.SponsorUncheckedCreateInput>,
    participations: Prisma.EditionSponsorUncheckedCreateWithoutSponsorInput[],
    contacts: Prisma.SponsorContactUncheckedCreateWithoutSponsorInput[] = [],
  ) => {
    const sponsor = await prisma.sponsor.create({
      data: {
        slug: `${P.toLowerCase()}-${key}-${Date.now()}`,
        name: `${P} ${key}`,
        ...identity,
        editions: { create: participations },
        contacts: { create: contacts },
      },
      include: { editions: true },
    });
    sponsorIds.push(sponsor.id);
    return sponsor;
  };
  // Kit received this year, its own logo, an account, one offer, complete profile.
  await prisma.user.upsert({ where: { email: "zq574@example.com" }, create: { id: "zq574-user", email: "zq574@example.com", name: "Zq", role: "SPONSOR" }, update: {} });
  const acme = await make(
    "Acme",
    { logoUrl: "/acme.png", websiteUrl: "https://acme.example", descriptionFr: "Desc" },
    [{ editionId, tierId: gold, publicationStatus: "PUBLISHED", comKitReceived: true }],
    [{ email: "a@acme.example", userId: "zq574-user", invitationAcceptedAt: new Date() }],
  );
  await prisma.sponsorJobOffer.create({ data: { title: "Dev", url: "https://acme.example/jobs", editionSponsorId: acme.editions[0].id } });
  // Kit received last year only, no logo, an invitation pending, no offer.
  await make(
    "Bolt",
    {},
    [
      { editionId, tierId: discovery, publicationStatus: "DRAFT", comKitReceived: false },
      { editionId: previousId, tierId: gold, publicationStatus: "PUBLISHED", comKitReceived: true },
    ],
    [{ email: "b@bolt.example", invitationToken: `tok-${Date.now()}-b`, invitationSentAt: new Date() }],
  );
  // Nobody to invite, no website, no description.
  await make("Cube", { logoUrl: "/cube.png" }, [{ editionId, tierId: gold, publicationStatus: "DRAFT" }]);
});

afterAll(async () => {
  await prisma.sponsor.deleteMany({ where: { id: { in: sponsorIds } } });
  await prisma.user.deleteMany({ where: { id: "zq574-user" } });
  await prisma.edition.deleteMany({ where: { id: { in: [editionId, previousId] } } });
  await app.close();
});

async function list(query: Record<string, string>) {
  const params = new URLSearchParams({ search: P, editionId: String(editionId), page: "1", ...query });
  return app.inject({ method: "GET", url: `/api/admin/sponsors?${params}` });
}

const names = (body: { items: { name: string }[] }) => body.items.map((s) => s.name.replace(`${P} `, ""));

describe("Admin sponsors list (#574)", () => {
  it("should page the list and say how many sponsors match", async () => {
    const body = (await list({ limit: "2" })).json();

    expect(body).toMatchObject({ page: 1, limit: 2, total: 3 });
    expect(names(body)).toEqual(["Acme", "Bolt"]);
  });

  it("should read the kit on the year looked at, not on another one", async () => {
    expect(names((await list({ comKit: "missing" })).json())).toEqual(["Bolt", "Cube"]);
    expect(names((await list({ comKit: "received" })).json())).toEqual(["Acme"]);
  });

  it("should find the missing logos, the access to give and the offers to chase", async () => {
    expect(names((await list({ logo: "missing" })).json())).toEqual(["Bolt"]);
    expect(names((await list({ contacts: "none" })).json())).toEqual(["Cube"]);
    expect(names((await list({ contacts: "pending" })).json())).toEqual(["Bolt"]);
    expect(names((await list({ contacts: "active" })).json())).toEqual(["Acme"]);
    expect(names((await list({ jobOffers: "without" })).json())).toEqual(["Bolt", "Cube"]);
  });

  it("should find incomplete profiles and filter on tier and status", async () => {
    expect(names((await list({ missing: "website" })).json())).toEqual(["Bolt", "Cube"]);
    expect(names((await list({ missing: "description,website" })).json())).toEqual(["Bolt", "Cube"]);
    expect(names((await list({ tierKey: "discovery" })).json())).toEqual(["Bolt"]);
    expect(names((await list({ status: "PUBLISHED" })).json())).toEqual(["Acme"]);
  });

  it("should sort by tier rank, the order of the public page", async () => {
    const asc = names((await list({ sort: "tier", order: "asc" })).json());

    expect(asc.at(-1)).toBe("Bolt");
  });

  it("should keep the full array when no page is asked for, without any invitation token", async () => {
    const res = await app.inject({ method: "GET", url: `/api/admin/sponsors?editionId=${editionId}&search=${P}` });

    expect(Array.isArray(res.json())).toBe(true);
    expect(res.json()).toHaveLength(3);
    expect(res.body).not.toContain("invitationToken");
    expect(res.json()[0]).toMatchObject({ contactState: "active", jobOfferCount: 1, hasLogo: true });
  });

  it("should refuse a follow-up filter without an edition rather than guess the year", async () => {
    const res = await app.inject({ method: "GET", url: `/api/admin/sponsors?page=1&comKit=missing&search=${P}` });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("edition_required");
  });
});
