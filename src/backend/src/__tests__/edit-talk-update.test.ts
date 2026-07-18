import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// The talk-edit endpoint notifies the CFP address on success; stub SMTP so the
// tests don't depend on a mail server. Must be hoisted above the app import.
const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn().mockResolvedValue({}) }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));

import { buildEditApp } from "./test-edit-app.js";
import { prisma } from "../lib/prisma.js";

// PUT /api/edit/:token/talks/:talkId — a speaker edits the descriptive content
// of one of their published sessions (#260).

const TOKEN = "test-talk-update-token-fedcba9876543210aa";
const OTHER_TOKEN = "test-talk-update-other-token-0011223344556677";

let editionId: number;
let speakerId: number;
let otherSpeakerId: number;
let ownedTalkId: number;
let draftTalkId: number;
let foreignTalkId: number;

describe("PUT /api/edit/:token/talks/:talkId — speaker edits a session (#260)", () => {
  beforeAll(async () => {
    const edition = await prisma.edition.findFirst({ orderBy: { year: "desc" } });
    if (!edition) throw new Error("seed missing an edition");
    editionId = edition.id;

    const speaker = await prisma.speaker.create({
      data: {
        name: "Talk Update Speaker",
        slug: "talk-update-speaker",
        editionId,
        editToken: TOKEN,
        editTokenSentAt: new Date(),
        publicationStatus: "PUBLISHED",
      },
    });
    speakerId = speaker.id;

    const other = await prisma.speaker.create({
      data: {
        name: "Other Speaker",
        slug: "talk-update-other-speaker",
        editionId,
        editToken: OTHER_TOKEN,
        editTokenSentAt: new Date(),
        publicationStatus: "PUBLISHED",
      },
    });
    otherSpeakerId = other.id;

    const owned = await prisma.talk.create({
      data: {
        editionId, slug: "talk-update-owned", titleFr: "Titre initial", titleEn: "Initial title",
        descriptionFr: "desc fr", descriptionEn: "desc en", format: "CONFERENCE", level: "DEBUTANT",
        language: "fr", publicationStatus: "PUBLISHED", speakers: { connect: { id: speakerId } },
      },
    });
    ownedTalkId = owned.id;

    const draft = await prisma.talk.create({
      data: {
        editionId, slug: "talk-update-draft", titleFr: "Brouillon", titleEn: "Draft",
        descriptionFr: "", descriptionEn: "", format: "CONFERENCE", language: "fr",
        publicationStatus: "DRAFT", speakers: { connect: { id: speakerId } },
      },
    });
    draftTalkId = draft.id;

    const foreign = await prisma.talk.create({
      data: {
        editionId, slug: "talk-update-foreign", titleFr: "Talk d'un autre", titleEn: "Someone else's",
        descriptionFr: "", descriptionEn: "", format: "CONFERENCE", language: "fr",
        publicationStatus: "PUBLISHED", speakers: { connect: { id: otherSpeakerId } },
      },
    });
    foreignTalkId = foreign.id;
  });

  afterAll(async () => {
    await prisma.talk.deleteMany({ where: { id: { in: [ownedTalkId, draftTalkId, foreignTalkId] } } });
    await prisma.speaker.deleteMany({ where: { id: { in: [speakerId, otherSpeakerId] } } });
  });

  beforeEach(() => sendMailMock.mockClear());

  it("updates the descriptive fields and notifies the CFP address", async () => {
    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${TOKEN}/talks/${ownedTalkId}`,
      payload: { titleFr: "Nouveau titre", descriptionFr: "Nouveau résumé", format: "WORKSHOP", level: "" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ saved: true });

    const talk = await prisma.talk.findUnique({ where: { id: ownedTalkId } });
    expect(talk?.titleFr).toBe("Nouveau titre");
    expect(talk?.descriptionFr).toBe("Nouveau résumé");
    expect(talk?.format).toBe("WORKSHOP");
    // Empty level clears back to "all levels".
    expect(talk?.level).toBeNull();
    // Untouched fields stay put.
    expect(talk?.titleEn).toBe("Initial title");

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("rejects a talk the token does not present (404), without touching it", async () => {
    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${TOKEN}/talks/${foreignTalkId}`,
      payload: { titleFr: "Piratage" },
    });
    expect(res.statusCode).toBe(404);

    const talk = await prisma.talk.findUnique({ where: { id: foreignTalkId } });
    expect(talk?.titleFr).toBe("Talk d'un autre");
    expect(sendMailMock).not.toHaveBeenCalled();
    await app.close();
  });

  it("does not expose an unpublished talk for editing (404)", async () => {
    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${TOKEN}/talks/${draftTalkId}`,
      payload: { titleFr: "Nope" },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("rejects an unknown field (400) instead of silently dropping it", async () => {
    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${TOKEN}/talks/${ownedTalkId}`,
      payload: { titleFr: "OK", publicationStatus: "DRAFT" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("forbidden_field");
    await app.close();
  });

  it("rejects an invalid enum value (400)", async () => {
    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${TOKEN}/talks/${ownedTalkId}`,
      payload: { format: "LIGHTNING" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("rejects a blank title (400)", async () => {
    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${TOKEN}/talks/${ownedTalkId}`,
      payload: { titleFr: "   " },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("empty_title");
    await app.close();
  });

  it("rejects a sponsor token (404 — no session to edit)", async () => {
    const sponsorToken = "test-talk-update-sponsor-token-8899aabbccddeeff";
    const sponsor = await prisma.sponsor.create({
      data: {
        name: "Talk Update Sponsor", slug: "talk-update-sponsor", editionId, level: "GOLD",
        editToken: sponsorToken, editTokenSentAt: new Date(), publicationStatus: "PUBLISHED",
      },
    });
    const app = await buildEditApp();
    const res = await app.inject({
      method: "PUT",
      url: `/api/edit/${sponsorToken}/talks/${ownedTalkId}`,
      payload: { titleFr: "Nope" },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
    await prisma.sponsor.deleteMany({ where: { id: sponsor.id } });
  });
});
