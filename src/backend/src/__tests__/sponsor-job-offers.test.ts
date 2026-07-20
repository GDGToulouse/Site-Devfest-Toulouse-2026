import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildEditApp } from "./test-edit-app.js";
import { buildPublicApp } from "./test-public-app.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { createSponsorWithToken } from "./sponsor-test-helpers.js";

// Sponsor job offers (#251): CRUD via the magic link, quota per level, HTML
// sanitized, exposed publicly.

const GOLD_TOKEN = "test-offers-gold-token-aabbccddee001122";
let editionId: number;
let goldSponsorId: number;
let goldSlug: string;

describe("Sponsor job offers (#251)", () => {
  beforeAll(async () => {
    const edition = await getSeededEdition();
    editionId = edition.id;
    goldSlug = `offers-gold-${Date.now()}`;

    const sponsor = await createSponsorWithToken(
      { name: "Offers Gold", slug: goldSlug, editionId, level: "GOLD", publicationStatus: "PUBLISHED" },
      GOLD_TOKEN,
    );
    goldSponsorId = sponsor.id;
  });

  afterAll(async () => {
    await prisma.sponsor.deleteMany({ where: { id: goldSponsorId } });
  });

  it("exposes the level quota in the GET private payload", async () => {
    const app = await buildEditApp();
    const res = await app.inject({ method: "GET", url: `/api/edit/${GOLD_TOKEN}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().jobOffers.quota).toBe(2); // Gold
    expect(res.json().jobOffers.items).toHaveLength(0);
    await app.close();
  });

  it("creates an offer and sanitizes both descriptions", async () => {
    const app = await buildEditApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/edit/${GOLD_TOKEN}/job-offers`,
      payload: {
        title: "Dev",
        descriptionFr: "<p>Ok</p><script>alert(1)</script>",
        descriptionEn: "<p>Fine</p><script>alert(2)</script>",
        url: "https://jobs.example.org/1",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().descriptionFr).toBe("<p>Ok</p>");
    expect(res.json().descriptionEn).toBe("<p>Fine</p>");
    await app.close();
  });

  it("enforces the level quota (Gold = 2)", async () => {
    const app = await buildEditApp();
    // One already exists; add a second (ok) then a third (rejected).
    const ok = await app.inject({
      method: "POST", url: `/api/edit/${GOLD_TOKEN}/job-offers`,
      payload: { title: "Second", url: "https://jobs.example.org/2" },
    });
    expect(ok.statusCode).toBe(201);

    const rejected = await app.inject({
      method: "POST", url: `/api/edit/${GOLD_TOKEN}/job-offers`,
      payload: { title: "Third", url: "https://jobs.example.org/3" },
    });
    expect(rejected.statusCode).toBe(409);
    expect(rejected.json().error).toBe("quota_reached");
    await app.close();
  });

  it("rejects an unsafe URL", async () => {
    const app = await buildEditApp();
    // Delete one first so quota isn't the blocker.
    const offer = await prisma.sponsorJobOffer.findFirst({ where: { sponsorId: goldSponsorId } });
    await prisma.sponsorJobOffer.delete({ where: { id: offer!.id } });

    const res = await app.inject({
      method: "POST", url: `/api/edit/${GOLD_TOKEN}/job-offers`,
      payload: { title: "Bad", url: "javascript:alert(1)" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_url");
    await app.close();
  });

  it("only edits offers belonging to the token's sponsor", async () => {
    const other = await prisma.sponsor.create({
      data: { name: "Other", slug: `offers-other-${Date.now()}`, editionId, level: "GOLD" },
    });
    const foreignOffer = await prisma.sponsorJobOffer.create({
      data: { sponsorId: other.id, title: "Foreign", descriptionFr: "", descriptionEn: "", url: "https://x.org" },
    });
    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${GOLD_TOKEN}/job-offers/${foreignOffer.id}`,
      payload: { title: "hack" },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
    await prisma.sponsor.deleteMany({ where: { id: other.id } });
  });

  it("exposes offers on the public sponsor page and the recap list", async () => {
    const app = await buildPublicApp();

    const detail = await app.inject({ method: "GET", url: `/api/sponsors/${goldSlug}` });
    expect(detail.statusCode).toBe(200);
    expect(Array.isArray(detail.json().jobOffers)).toBe(true);
    expect(detail.json().jobOffers.length).toBeGreaterThanOrEqual(1);
    // Both localized descriptions are exposed; the old single field is gone (#273).
    const offer = detail.json().jobOffers[0];
    expect(offer).toHaveProperty("descriptionFr");
    expect(offer).toHaveProperty("descriptionEn");
    expect(offer).not.toHaveProperty("description");

    const list = await app.inject({ method: "GET", url: `/api/job-offers` });
    expect(list.statusCode).toBe(200);
    expect(list.json().some((s: { slug: string }) => s.slug === goldSlug)).toBe(true);
    await app.close();
  });
});
