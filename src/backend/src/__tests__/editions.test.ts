import { describe, it, expect, afterAll } from "vitest";
import { buildApp } from "./test-app.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { tierIdByKey } from "./sponsor-test-helpers.js";

describe("GET /api/editions/current", () => {
  it("should return the current edition", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/editions/current" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("year", 2026);
    expect(body).toHaveProperty("status", "ANNOUNCEMENT");
    expect(body).toHaveProperty("aftermovieUrl");
    await app.close();
  });

  // hasJobOffers drives the "Offres d'emploi" nav sub-entry: it must only be
  // true while a published sponsor actually has an offer.
  it("flags hasJobOffers only when a published sponsor has an offer", async () => {
    const edition = await getSeededEdition();

    // Baseline: the seed ships no job offer.
    const app = await buildApp();
    const before = await app.inject({ method: "GET", url: "/api/editions/current" });
    expect(before.json().hasJobOffers).toBe(false);
    await app.close();

    const sponsor = await prisma.sponsor.create({
      data: {
        name: "Nav Offers", slug: `nav-offers-${Date.now()}`, editionId: edition.id,
        tierId: await tierIdByKey("gold"), publicationStatus: "PUBLISHED",
      },
    });
    await prisma.sponsorJobOffer.create({
      data: { sponsorId: sponsor.id, title: "Dev", descriptionFr: "", descriptionEn: "", url: "https://x.org" },
    });

    const app2 = await buildApp();
    const after = await app2.inject({ method: "GET", url: "/api/editions/current" });
    expect(after.json().hasJobOffers).toBe(true);
    await app2.close();

    await prisma.sponsor.deleteMany({ where: { id: sponsor.id } });
  });
});

describe("GET /api/editions/current/ticket-tiers", () => {
  it("should return active ticket tiers", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/editions/current/ticket-tiers" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    for (const tier of body) {
      expect(tier).toHaveProperty("nameFr");
      expect(tier).toHaveProperty("price");
      expect(["AVAILABLE", "SOLD_OUT", "COMING_SOON"]).toContain(tier.status);
    }
    await app.close();
  });
});
