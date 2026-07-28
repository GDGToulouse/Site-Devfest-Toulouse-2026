import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildEditApp } from "./test-edit-app.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// GET /api/edit/:token exposes the speaker's accepted sessions read-only (#229):
// only PUBLISHED talks are surfaced, and a sponsor token carries no `talks`.

const TOKEN = "test-edit-speaker-talks-token-abcdef0123456789";
let editionId: number;
let speakerId: number;
const talkIds: number[] = [];

describe("GET /api/edit/:token — speaker sessions (#229)", () => {
  beforeAll(async () => {
    const edition = await getSeededEdition();
    editionId = edition.id;

    const speaker = await prisma.speaker.create({
      data: {
        name: "Sessions Test Speaker",
        slug: "sessions-test-speaker",
        editToken: TOKEN,
        editTokenSentAt: new Date(),
        editions: { create: [{ editionId, publicationStatus: "PUBLISHED" }] },
      },
    });
    speakerId = speaker.id;

    const published = await prisma.talk.create({
      data: {
        editionId, slug: "sessions-test-published", title: "Talk publié",
        description: "", format: "WORKSHOP", language: "fr",
        publicationStatus: "PUBLISHED", speakers: { connect: { id: speakerId } },
      },
    });
    const draft = await prisma.talk.create({
      data: {
        editionId, slug: "sessions-test-draft", title: "Talk brouillon",
        description: "", format: "CONFERENCE", language: "fr",
        publicationStatus: "DRAFT", speakers: { connect: { id: speakerId } },
      },
    });
    talkIds.push(published.id, draft.id);
  });

  afterAll(async () => {
    await prisma.talk.deleteMany({ where: { id: { in: talkIds } } });
    await prisma.speaker.deleteMany({ where: { id: speakerId } });
  });

  it("returns only the speaker's PUBLISHED talks, read-only", async () => {
    const app = await buildEditApp();
    const res = await app.inject({ method: "GET", url: `/api/edit/${TOKEN}` });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.kind).toBe("speaker");
    expect(Array.isArray(body.talks)).toBe(true);
    expect(body.talks).toHaveLength(1);
    expect(body.talks[0]).toMatchObject({
      slug: "sessions-test-published",
      title: "Talk publié",
      format: "WORKSHOP",
    });
    await app.close();
  });
});
