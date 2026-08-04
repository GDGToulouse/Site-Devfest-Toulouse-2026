import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildEditApp } from "./test-edit-app.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { createSponsorFixture, tierIdByKey } from "./sponsor-test-helpers.js";

// Secondary contacts (#250): a sponsor can have several contacts, each with its
// own modification link, lock and expiry — all editing the same sponsor page.

const TOKEN_A = "test-contacts-token-a-1111222233334444aa";
const TOKEN_B = "test-contacts-token-b-5555666677778888bb";
let editionId: number;
let sponsorId: number;

describe("Sponsor secondary contacts (#250)", () => {
  beforeAll(async () => {
    const edition = await getSeededEdition();
    editionId = edition.id;

    const sponsor = await createSponsorFixture({
      name: "Multi Contact Sponsor", slug: `multi-contact-${Date.now()}`, editionId, tierId: await tierIdByKey("gold"),
      publicationStatus: "PUBLISHED",
    });
    sponsorId = sponsor.id;
    await prisma.sponsorContact.createMany({
      data: [
        { sponsorId, email: "primary@example.org", editToken: TOKEN_A, editTokenSentAt: new Date() },
        { sponsorId, email: "secondary@example.org", editToken: TOKEN_B, editTokenSentAt: new Date() },
      ],
    });
  });

  afterAll(async () => {
    await prisma.sponsor.deleteMany({ where: { id: sponsorId } });
  });

  it("resolves both contact tokens to the same sponsor", async () => {
    const app = await buildEditApp();
    for (const token of [TOKEN_A, TOKEN_B]) {
      const res = await app.inject({ method: "GET", url: `/api/edit/${token}` });
      expect(res.statusCode).toBe(200);
      expect(res.json().kind).toBe("sponsor");
      expect(res.json().name).toBe("Multi Contact Sponsor");
    }
    await app.close();
  });

  it("both links edit the same sponsor page", async () => {
    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${TOKEN_B}`,
      payload: { descriptionFr: "Édité par le second contact" },
    });
    expect(res.statusCode).toBe(200);
    const sponsor = await prisma.sponsor.findUnique({ where: { id: sponsorId } });
    expect(sponsor?.descriptionFr).toBe("Édité par le second contact");
    await app.close();
  });

  it("locking one contact does not block the other", async () => {
    // Lock contact A only.
    await prisma.sponsorContact.updateMany({
      where: { sponsorId, editToken: TOKEN_A },
      data: { editLinkLocked: true },
    });
    const app = await buildEditApp();

    const lockedRes = await app.inject({ method: "GET", url: `/api/edit/${TOKEN_A}` });
    expect(lockedRes.statusCode).toBe(403);
    expect(lockedRes.json().error).toBe("locked");

    const openRes = await app.inject({ method: "GET", url: `/api/edit/${TOKEN_B}` });
    expect(openRes.statusCode).toBe(200);
    await app.close();

    // Restore for isolation.
    await prisma.sponsorContact.updateMany({
      where: { sponsorId, editToken: TOKEN_A },
      data: { editLinkLocked: false },
    });
  });
});
