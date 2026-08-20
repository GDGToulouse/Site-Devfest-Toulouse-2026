import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildEditApp } from "./test-edit-app.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// Bluesky is part of the shared socialLinks allowlist (#253); an unknown social
// key stays rejected. Exercised on a speaker: the rule is the same for both, and
// sponsors no longer reach this route at all (#362).

const TOKEN = "test-edit-bluesky-speaker-token-a1b2c3d4e5f6a7b8";
let speakerId: number;

describe("PUT /api/edit/:token — bluesky social link (#253)", () => {
  beforeAll(async () => {
    const edition = await getSeededEdition();

    const speaker = await prisma.speaker.create({
      data: {
        name: "Bluesky Test Speaker",
        slug: `bluesky-test-speaker-${Date.now()}`,
        editToken: TOKEN,
        editTokenSentAt: new Date(),
        editions: { create: [{ editionId: edition.id, publicationStatus: "PUBLISHED" }] },
      },
    });
    speakerId = speaker.id;
  });

  afterAll(async () => {
    await prisma.speaker.deleteMany({ where: { id: speakerId } });
  });

  it("accepts and persists a bluesky link", async () => {
    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${TOKEN}`,
      payload: { socialLinks: { bluesky: "https://bsky.app/profile/devfest.example" } },
    });
    expect(res.statusCode).toBe(200);

    const speaker = await prisma.speaker.findUnique({ where: { id: speakerId } });
    const social = JSON.parse(speaker?.socialLinks ?? "{}");
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
