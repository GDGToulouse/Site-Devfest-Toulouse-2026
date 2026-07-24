import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildEditApp } from "./test-edit-app.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { createSponsorWithToken, tierIdByKey } from "./sponsor-test-helpers.js";

// Bluesky is part of the shared socialLinks allowlist (#253). A sponsor (and a
// speaker) can save it via their edit link; an unknown social key stays rejected.

const TOKEN = "test-edit-bluesky-sponsor-token-a1b2c3d4e5f6a7b8";
let editionId: number;
let sponsorId: number;

describe("PUT /api/edit/:token — bluesky social link (#253)", () => {
  beforeAll(async () => {
    const edition = await getSeededEdition();
    editionId = edition.id;

    const sponsor = await createSponsorWithToken({
      name: "Bluesky Test Sponsor", slug: "bluesky-test-sponsor", editionId, tierId: await tierIdByKey("gold"),
      publicationStatus: "PUBLISHED",
    }, TOKEN);
    sponsorId = sponsor.id;
  });

  afterAll(async () => {
    await prisma.sponsor.deleteMany({ where: { id: sponsorId } });
  });

  it("accepts and persists a bluesky link", async () => {
    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${TOKEN}`,
      payload: { socialLinks: { bluesky: "https://bsky.app/profile/devfest.example" } },
    });
    expect(res.statusCode).toBe(200);

    const sponsor = await prisma.sponsor.findUnique({ where: { id: sponsorId } });
    const social = JSON.parse(sponsor?.socialLinks ?? "{}");
    expect(social.bluesky).toBe("https://bsky.app/profile/devfest.example");
    await app.close();
  });

  it("still rejects an unknown social key", async () => {
    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${TOKEN}`,
      payload: { socialLinks: { mastodon: "https://example.social/@x" } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("forbidden_field");
    await app.close();
  });
});
