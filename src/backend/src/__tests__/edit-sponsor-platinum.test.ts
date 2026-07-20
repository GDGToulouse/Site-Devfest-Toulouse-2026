import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildEditApp } from "./test-edit-app.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { createSponsorWithToken } from "./sponsor-test-helpers.js";

// Platinum-only promo ideas (#252): writable via the magic link only when the
// sponsor is Platinum. For any other level the fields are silently ignored, so
// they can't be set by tampering with the payload.

const PLATINUM_TOKEN = "test-platinum-token-1122334455667788aa";
const GOLD_TOKEN = "test-gold-token-99aabbccddeeff001122";
let editionId: number;
let platinumId: number;
let goldId: number;

describe("Sponsor Platinum promo content (#252)", () => {
  beforeAll(async () => {
    const edition = await getSeededEdition();
    editionId = edition.id;

    const platinum = await createSponsorWithToken({
      name: "Platinum Test", slug: `platinum-test-${Date.now()}`, editionId, level: "PLATINUM",
      publicationStatus: "PUBLISHED",
    }, PLATINUM_TOKEN);
    platinumId = platinum.id;

    const gold = await createSponsorWithToken({
      name: "Gold Test", slug: `gold-test-${Date.now()}`, editionId, level: "GOLD",
      publicationStatus: "PUBLISHED",
    }, GOLD_TOKEN);
    goldId = gold.id;
  });

  afterAll(async () => {
    await prisma.sponsor.deleteMany({ where: { id: { in: [platinumId, goldId] } } });
  });

  it("persists the Platinum ideas for a Platinum sponsor", async () => {
    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${PLATINUM_TOKEN}`,
      payload: { platinumPromoIdea: "Une vidéo produit", platinumCoBuildIdea: "Un live technique" },
    });
    expect(res.statusCode).toBe(200);

    const sponsor = await prisma.sponsor.findUnique({ where: { id: platinumId } });
    expect(sponsor?.platinumPromoIdea).toBe("Une vidéo produit");
    expect(sponsor?.platinumCoBuildIdea).toBe("Un live technique");
    await app.close();
  });

  it("ignores the Platinum ideas for a non-Platinum sponsor", async () => {
    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${GOLD_TOKEN}`,
      payload: { platinumPromoIdea: "Devrait être ignoré" },
    });
    // The request itself is valid (field is allowlisted); it's just not written.
    expect(res.statusCode).toBe(200);

    const sponsor = await prisma.sponsor.findUnique({ where: { id: goldId } });
    expect(sponsor?.platinumPromoIdea).toBeNull();
    await app.close();
  });

  it("exposes the level in the private block so the UI can gate the fields", async () => {
    const app = await buildEditApp();
    const res = await app.inject({ method: "GET", url: `/api/edit/${PLATINUM_TOKEN}` });
    expect(res.json().private.level).toBe("PLATINUM");
    await app.close();
  });
});
