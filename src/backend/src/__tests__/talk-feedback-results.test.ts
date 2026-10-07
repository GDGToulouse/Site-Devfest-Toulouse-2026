import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import adminFeedbackRoutes from "../routes/admin/feedback.js";
import editRoutes from "../routes/edit.js";

// #565 — the detailed results of the audience feedback: for the speaker from
// their link, frozen or not, and for the team in the admin, where a message
// out of place can be hidden. On an edition of its own (1994).

const YEAR = 1994;
// An edition in the past: the edit form is frozen (RG-246) — exactly when the
// feedback comes in. The results must still be readable.
const START = new Date("1994-11-19T00:00:00.000Z");
const TOKEN = `feedback-results-${randomUUID()}`;

let app: FastifyInstance;
let editionId: number;
let talkId: number;
let otherTalkId: number;
let rudeId: number;

beforeAll(async () => {
  await prisma.edition.deleteMany({ where: { year: YEAR } });
  const edition = await prisma.edition.create({ data: { year: YEAR, startDate: START, endDate: START } });
  editionId = edition.id;
  const speaker = await prisma.speaker.create({
    data: { slug: `feedback-results-${randomUUID()}`, name: "Ada Results", editToken: TOKEN, editTokenSentAt: new Date() },
  });
  const talk = await prisma.talk.create({
    data: {
      editionId, slug: "feedback-results", title: "Mesurer l'avis", description: "", format: "CONFERENCE", language: "fr",
      publicationStatus: "PUBLISHED", speakers: { connect: { id: speaker.id } },
    },
  });
  talkId = talk.id;
  const other = await prisma.talk.create({
    data: { editionId, slug: "feedback-results-other", title: "Autre session", description: "", format: "CONFERENCE", language: "fr", publicationStatus: "PUBLISHED" },
  });
  otherTalkId = other.id;

  const v = () => randomUUID();
  await prisma.talkFeedback.create({ data: { talkId, voterId: v(), items: ["learned", "notClear"], message: "Très clair, merci", messageAt: new Date() } });
  const rude = await prisma.talkFeedback.create({ data: { talkId, voterId: v(), items: ["notClear"], message: "Message déplacé", messageAt: new Date() } });
  rudeId = rude.id;
  await prisma.talkFeedback.create({ data: { talkId, voterId: v(), items: ["learned"] } });
  await prisma.talkFeedback.create({ data: { talkId: otherTalkId, voterId: v(), items: ["fun"], message: "Pour l'autre speaker", messageAt: new Date() } });

  app = Fastify();
  await app.register(adminFeedbackRoutes, { prefix: "/api/admin" });
  await app.register(editRoutes, { prefix: "/api" });
});

afterAll(async () => {
  await prisma.edition.deleteMany({ where: { year: YEAR } });
  await prisma.speaker.deleteMany({ where: { editToken: TOKEN } });
  await app?.close();
});

const count = (items: { code: string; count: number }[], code: string) => items.find((i) => i.code === code)?.count;

describe("admin results (#565)", () => {
  it("should list the sessions most voted first, negatives counted", async () => {
    const res = await app.inject({ method: "GET", url: `/api/admin/editions/${editionId}/feedback` });
    const [first, second] = res.json().talks;

    expect(first).toMatchObject({ id: talkId, votes: 3, messages: 2 });
    expect(count(first.items, "notClear")).toBe(2);
    expect(second).toMatchObject({ id: otherTalkId, votes: 1 });
  });

  it("should give one session's messages, with the hidden flag", async () => {
    const res = await app.inject({ method: "GET", url: `/api/admin/talks/${talkId}/feedback` });

    expect(res.json().messages.map((m: { text: string }) => m.text).sort()).toEqual(["Message déplacé", "Très clair, merci"]);
  });
});

describe("hiding a message (#565)", () => {
  it("should keep a hidden message from the speaker and flag it for the team", async () => {
    await app.inject({ method: "PUT", url: `/api/admin/feedback/${rudeId}/message`, payload: { hidden: true } });

    const speaker = await app.inject({ method: "GET", url: `/api/edit/${TOKEN}/feedback` });
    expect(JSON.stringify(speaker.json())).not.toContain("Message déplacé");

    const admin = await app.inject({ method: "GET", url: `/api/admin/talks/${talkId}/feedback` });
    expect(admin.json().messages).toContainEqual(expect.objectContaining({ text: "Message déplacé", hidden: true }));

    await app.inject({ method: "PUT", url: `/api/admin/feedback/${rudeId}/message`, payload: { hidden: false } });
  });
});

describe("speaker results from the link (#565)", () => {
  it("should give the speaker their sessions only, while the edit form is frozen", async () => {
    const res = await app.inject({ method: "GET", url: `/api/edit/${TOKEN}/feedback` });

    expect(res.statusCode).toBe(200);
    expect(res.json().talks.map((t: { id: number }) => t.id)).toEqual([talkId]);
    expect(JSON.stringify(res.json())).not.toContain("Pour l'autre speaker");
  });

  it("should still refuse an unknown link", async () => {
    const res = await app.inject({ method: "GET", url: "/api/edit/not-a-token/feedback" });

    expect(res.statusCode).toBe(404);
  });
});
