process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import sponsorSpaceRoutes from "../routes/sponsor-space.js";
import { prisma } from "../lib/prisma.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { createSponsorFixture, tierIdByKey } from "./sponsor-test-helpers.js";

// #251 moved to the account-based space (#362). Job offers used to be reachable
// only through the anonymous edit link; they have to exist here before that link
// can be cut, or sponsors simply lose the feature.
//
// Authenticated through the API-key path like sponsor-space-access.test.ts.

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

// A sponsor participating in the featured edition, plus someone who may act on
// it. tierKey drives the quota: discovery = 1 offer, gold = 2.
async function createSpace(name: string, tierKey: string, accessRole: "RESPONSABLE" | "EDITEUR" | "STAND") {
  const suffix = `${Date.now()}-${Math.round(performance.now())}`;
  const sponsor = await createSponsorFixture({
    name: `${name} ${suffix}`,
    slug: `${name.toLowerCase().replace(/\W+/g, "-")}-${suffix}`,
    editionId,
    tierId: await tierIdByKey(tierKey),
  });
  created.sponsorIds.push(sponsor.id);

  const { user, bearer } = await createAccount(`${name.toLowerCase().replace(/\W+/g, "-")}-${suffix}@example.org`);
  await prisma.sponsorContact.create({
    data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole },
  });
  return { sponsor, headers: { authorization: `Bearer ${bearer}` } };
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

describe("Sponsor space job offers (#251 via #362)", () => {
  it("exposes the tier quota to a STAND member", async () => {
    const { sponsor, headers } = await createSpace("Quota Read Co", "gold", "STAND");

    const res = await app.inject({
      method: "GET",
      url: `/api/sponsor-space/${sponsor.id}/job-offers`,
      headers,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().quota).toBe(2);
    expect(res.json().offers).toEqual([]);
  });

  it("creates an offer and sanitizes both descriptions", async () => {
    const { sponsor, headers } = await createSpace("Create Offer Co", "gold", "EDITEUR");

    const res = await app.inject({
      method: "POST",
      url: `/api/sponsor-space/${sponsor.id}/job-offers`,
      headers,
      payload: {
        title: "  Staff Engineer  ",
        descriptionFr: "<p>Un poste<script>alert(1)</script></p>",
        descriptionEn: "<p>A role<script>alert(1)</script></p>",
        url: "https://example.org/jobs/1",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.title).toBe("Staff Engineer");
    expect(body.descriptionFr).not.toContain("<script>");
    expect(body.descriptionEn).not.toContain("<script>");
  });

  it("refuses an offer beyond the tier quota", async () => {
    const { sponsor, headers } = await createSpace("Capped Co", "discovery", "EDITEUR");
    const url = `/api/sponsor-space/${sponsor.id}/job-offers`;
    const payload = { title: "First", url: "https://example.org/jobs/1" };

    const first = await app.inject({ method: "POST", url, headers, payload });
    const second = await app.inject({
      method: "POST",
      url,
      headers,
      payload: { title: "Second", url: "https://example.org/jobs/2" },
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe("quota_reached");
  });

  it("refuses a write from a STAND member", async () => {
    const { sponsor, headers } = await createSpace("Read Only Co", "gold", "STAND");

    const res = await app.inject({
      method: "POST",
      url: `/api/sponsor-space/${sponsor.id}/job-offers`,
      headers,
      payload: { title: "Nope", url: "https://example.org/jobs/1" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("rejects an unsafe URL", async () => {
    const { sponsor, headers } = await createSpace("Unsafe Url Co", "gold", "EDITEUR");

    const res = await app.inject({
      method: "POST",
      url: `/api/sponsor-space/${sponsor.id}/job-offers`,
      headers,
      // eslint-disable-next-line no-script-url
      payload: { title: "Bad", url: "javascript:alert(1)" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_url");
  });

  it("answers 404 for an offer belonging to another company", async () => {
    const mine = await createSpace("Mine Co", "gold", "EDITEUR");
    const theirs = await createSpace("Theirs Co", "gold", "EDITEUR");

    const created = await app.inject({
      method: "POST",
      url: `/api/sponsor-space/${theirs.sponsor.id}/job-offers`,
      headers: theirs.headers,
      payload: { title: "Theirs", url: "https://example.org/jobs/9" },
    });
    const foreignOfferId = created.json().id;

    // Probing another company's offer id must not confirm it exists.
    const res = await app.inject({
      method: "PUT",
      url: `/api/sponsor-space/${mine.sponsor.id}/job-offers/${foreignOfferId}`,
      headers: mine.headers,
      payload: { title: "Stolen" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("deletes an offer, freeing a slot under the quota", async () => {
    const { sponsor, headers } = await createSpace("Delete Offer Co", "discovery", "EDITEUR");
    const url = `/api/sponsor-space/${sponsor.id}/job-offers`;

    const created = await app.inject({
      method: "POST",
      url,
      headers,
      payload: { title: "Temporary", url: "https://example.org/jobs/1" },
    });
    const del = await app.inject({
      method: "DELETE",
      url: `${url}/${created.json().id}`,
      headers,
    });
    const after = await app.inject({ method: "GET", url, headers });

    expect(del.statusCode).toBe(204);
    expect(after.json().offers).toEqual([]);
  });

  it("answers 422 when the company does not sponsor the featured edition", async () => {
    const suffix = `${Date.now()}-${Math.round(performance.now())}`;
    // No participation at all: nothing to publish an offer for.
    const sponsor = await prisma.sponsor.create({
      data: { name: `Absent Co ${suffix}`, slug: `absent-co-${suffix}` },
    });
    created.sponsorIds.push(sponsor.id);
    const { user, bearer } = await createAccount(`absent-${suffix}@example.org`);
    await prisma.sponsorContact.create({
      data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole: "EDITEUR" },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/sponsor-space/${sponsor.id}/job-offers`,
      headers: { authorization: `Bearer ${bearer}` },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe("no_current_participation");
  });
});
