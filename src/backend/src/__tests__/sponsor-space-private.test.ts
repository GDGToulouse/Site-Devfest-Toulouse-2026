process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import sponsorSpaceRoutes from "../routes/sponsor-space.js";
import { buildPublicApp } from "./test-public-app.js";
import { prisma } from "../lib/prisma.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { createSponsorFixture, tierIdByKey } from "./sponsor-test-helpers.js";

// Private sponsor fields (#249), Platinum promo ideas (#252) and rich-text
// descriptions (#270). These rules did not change with #362 — only the way in
// did: they used to be exercised through the anonymous edit link, which no
// longer serves sponsors.

let app: FastifyInstance;
let editionId: number;

const created = { userIds: [] as string[], sponsorIds: [] as number[] };

async function createAccount(email: string) {
  const user = await prisma.user.create({
    data: { email, name: email, role: "SPONSOR", emailVerified: true },
  });
  created.userIds.push(user.id);
  const key = await generateApiKey(resolveApiKeyEnv());
  await prisma.apiKey.create({
    data: { name: `test-${email}`, prefix: key.prefix, hashedKey: key.hashedKey, userId: user.id },
  });
  return { user, bearer: key.raw };
}

async function createSpace(name: string, tierKey: string) {
  const suffix = `${Date.now()}-${Math.round(performance.now())}`;
  const slug = `${name.toLowerCase().replace(/\W+/g, "-")}-${suffix}`;
  const sponsor = await createSponsorFixture({
    name: `${name} ${suffix}`,
    slug,
    editionId,
    tierId: await tierIdByKey(tierKey),
    publicationStatus: "PUBLISHED",
  });
  created.sponsorIds.push(sponsor.id);

  const { user, bearer } = await createAccount(`${slug}@example.org`);
  await prisma.sponsorContact.create({
    data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole: "EDITEUR" },
  });
  return { sponsor, slug, headers: { authorization: `Bearer ${bearer}` } };
}

beforeAll(async () => {
  const edition = await getSeededEdition();
  editionId = edition.id;

  app = Fastify({ logger: false });
  app.decorateRequest("authContext");
  app.decorateRequest("sponsorAccess");
  await app.register(sponsorSpaceRoutes, { prefix: "/api" });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  if (created.userIds.length) {
    await prisma.apiKey.deleteMany({ where: { userId: { in: created.userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  }
  if (created.sponsorIds.length) {
    await prisma.sponsor.deleteMany({ where: { id: { in: created.sponsorIds } } });
  }
});

describe("Sponsor private section (#249)", () => {
  it("persists private fields and drops empty stand contacts", async () => {
    const { sponsor, headers } = await createSpace("Private Co", "gold");

    const res = await app.inject({
      method: "PUT",
      url: `/api/sponsor-space/${sponsor.id}`,
      headers,
      payload: {
        standContacts: [{ name: "Alice", linkedin: "https://linkedin.com/in/alice" }, {}],
        comKitReceived: true,
        comKitLogoWebUrl: "https://example.org/logo-web.png",
        comKitNotes: "Charte à venir",
      },
    });

    expect(res.statusCode).toBe(200);
    const participation = await prisma.editionSponsor.findUniqueOrThrow({
      where: { sponsorId_editionId: { sponsorId: sponsor.id, editionId } },
    });
    expect(participation.comKitReceived).toBe(true);
    expect(participation.comKitLogoWebUrl).toBe("https://example.org/logo-web.png");

    const stored = await prisma.sponsor.findUniqueOrThrow({ where: { id: sponsor.id } });
    const stand = JSON.parse(stored.standContacts ?? "[]");
    expect(stand).toHaveLength(1);
    expect(stand[0].name).toBe("Alice");
  });

  it("returns the private block to the account holder", async () => {
    const { sponsor, headers } = await createSpace("Private Read Co", "gold");
    await app.inject({
      method: "PUT",
      url: `/api/sponsor-space/${sponsor.id}`,
      headers,
      payload: { comKitNotes: "Notes internes" },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/sponsor-space/${sponsor.id}/private`,
      headers,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().editions[0].comKitNotes).toBe("Notes internes");
  });

  it("rejects an unsafe URL in a stand contact", async () => {
    const { sponsor, headers } = await createSpace("Unsafe Stand Co", "gold");

    const res = await app.inject({
      method: "PUT",
      url: `/api/sponsor-space/${sponsor.id}`,
      headers,
      // eslint-disable-next-line no-script-url
      payload: { standContacts: [{ name: "Mallory", linkedin: "javascript:alert(1)" }] },
    });

    expect(res.statusCode).toBe(400);
  });

  it("NEVER exposes private fields on the public sponsor route", async () => {
    const { sponsor, slug, headers } = await createSpace("Public Leak Co", "gold");
    await app.inject({
      method: "PUT",
      url: `/api/sponsor-space/${sponsor.id}`,
      headers,
      payload: { comKitNotes: "Secret", standContacts: [{ name: "Alice" }] },
    });

    const publicApp = await buildPublicApp();
    const res = await publicApp.inject({ method: "GET", url: `/api/sponsors/${slug}` });
    await publicApp.close();

    const body = JSON.stringify(res.json());
    expect(body).not.toContain("Secret");
    expect(body).not.toContain("standContacts");
  });
});

describe("Sponsor Platinum promo content (#252)", () => {
  it("persists the Platinum ideas for a Platinum sponsor", async () => {
    const { sponsor, headers } = await createSpace("Platinum Co", "platinum");

    const res = await app.inject({
      method: "PUT",
      url: `/api/sponsor-space/${sponsor.id}`,
      headers,
      payload: { platinumPromoIdea: "Un atelier", platinumCoBuildIdea: "Un article" },
    });

    expect(res.statusCode).toBe(200);
    const participation = await prisma.editionSponsor.findUniqueOrThrow({
      where: { sponsorId_editionId: { sponsorId: sponsor.id, editionId } },
    });
    expect(participation.platinumPromoIdea).toBe("Un atelier");
  });

  it("ignores the Platinum ideas for a tier that does not allow them", async () => {
    const { sponsor, headers } = await createSpace("Gold Promo Co", "gold");

    await app.inject({
      method: "PUT",
      url: `/api/sponsor-space/${sponsor.id}`,
      headers,
      payload: { platinumPromoIdea: "Devrait être ignoré" },
    });

    const participation = await prisma.editionSponsor.findUniqueOrThrow({
      where: { sponsorId_editionId: { sponsorId: sponsor.id, editionId } },
    });
    expect(participation.platinumPromoIdea).toBeNull();
  });

  it("exposes the tier so the UI can gate the fields", async () => {
    const { sponsor, headers } = await createSpace("Gate Co", "platinum");

    const res = await app.inject({
      method: "GET",
      url: `/api/sponsor-space/${sponsor.id}/private`,
      headers,
    });

    expect(res.json().editions[0].tier.allowsPromoIdeas).toBe(true);
  });
});

describe("Sponsor rich-text description (#270)", () => {
  it("sanitizes rich-text HTML in both descriptions", async () => {
    const { sponsor, headers } = await createSpace("Rich Text Co", "gold");

    const res = await app.inject({
      method: "PUT",
      url: `/api/sponsor-space/${sponsor.id}`,
      headers,
      payload: {
        descriptionFr: "<p>Bonjour<script>alert(1)</script></p>",
        descriptionEn: "<p>Hello<script>alert(1)</script></p>",
      },
    });

    expect(res.statusCode).toBe(200);
    const stored = await prisma.sponsor.findUniqueOrThrow({ where: { id: sponsor.id } });
    expect(stored.descriptionFr).not.toContain("<script>");
    expect(stored.descriptionFr).toContain("Bonjour");
    expect(stored.descriptionEn).not.toContain("<script>");
  });

  it("stores null when the description is cleared", async () => {
    const { sponsor, headers } = await createSpace("Cleared Co", "gold");
    await app.inject({
      method: "PUT",
      url: `/api/sponsor-space/${sponsor.id}`,
      headers,
      payload: { descriptionFr: "<p>Du texte</p>" },
    });

    await app.inject({
      method: "PUT",
      url: `/api/sponsor-space/${sponsor.id}`,
      headers,
      payload: { descriptionFr: "" },
    });

    const stored = await prisma.sponsor.findUniqueOrThrow({ where: { id: sponsor.id } });
    expect(stored.descriptionFr).toBeNull();
  });
});
