import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { buildEditApp } from "./test-edit-app.js";
import { prisma } from "../lib/prisma.js";
import { createSponsorWithToken } from "./sponsor-test-helpers.js";

// Sponsor description is rich-text HTML (#270): sanitized on write via the
// magic link, same pipeline as article content.

const TOKEN = "test-sponsor-desc-token-1a2b3c4d5e6f7081";
let editionId: number;
let sponsorId: number;

describe("Sponsor rich-text description (#270)", () => {
  beforeAll(async () => {
    const edition = await prisma.edition.findFirst({ orderBy: { year: "desc" } });
    if (!edition) throw new Error("seed missing an edition");
    editionId = edition.id;

    const sponsor = await createSponsorWithToken(
      { name: "Desc Sponsor", slug: `desc-sponsor-${Date.now()}`, editionId, level: "GOLD" },
      TOKEN,
    );
    sponsorId = sponsor.id;
  });

  afterAll(async () => {
    await prisma.sponsor.deleteMany({ where: { id: sponsorId } });
  });

  it("sanitizes rich-text HTML in both descriptions", async () => {
    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${TOKEN}`,
      payload: {
        descriptionFr: "<p>Bonjour <strong>tous</strong></p><script>alert(1)</script>",
        descriptionEn: "<p>Hello <em>all</em></p><img src=x onerror=alert(2)>",
      },
    });
    expect(res.statusCode).toBe(200);

    const sponsor = await prisma.sponsor.findUnique({ where: { id: sponsorId } });
    expect(sponsor?.descriptionFr).toBe("<p>Bonjour <strong>tous</strong></p>");
    // The event handler is stripped; formatting is kept.
    expect(sponsor?.descriptionEn).toContain("<em>all</em>");
    expect(sponsor?.descriptionEn).not.toContain("onerror");
    await app.close();
  });

  it("stores null when the description is cleared", async () => {
    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${TOKEN}`,
      payload: { descriptionFr: "" },
    });
    expect(res.statusCode).toBe(200);

    const sponsor = await prisma.sponsor.findUnique({ where: { id: sponsorId } });
    expect(sponsor?.descriptionFr).toBeNull();
    await app.close();
  });
});
