import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { disableExpiredTestModes } from "../lib/talk-feedback-test-mode.js";
import adminFeedbackRoutes from "../routes/admin/feedback.js";
import talkFeedbackRoutes from "../routes/talk-feedback.js";

// The public routes vote on the featured edition: point it at this file's own
// edition, so switching its test mode on cannot open voting for other suites.
vi.mock("../routes/editions.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../routes/editions.js")>()),
  getFeaturedEdition: () => prisma.edition.findFirst({ where: { year: YEAR } }),
}));

// #566 — the feedback test mode opens voting before the event day, then its
// switch-off (by hand, or at midnight on the day) deletes the test votes and
// never a real one. On an edition of its own, so the shared seed is untouched.

const YEAR = 1995;
// Event day 2100-11-19: far enough that "before the day" holds when the suite
// runs, while the tests move the clock past it when they need to.
const START = new Date("2100-11-19T00:00:00.000Z");
const OPENS_AT = new Date("2100-11-18T23:00:00.000Z");

let app: FastifyInstance;
let editionId: number;
let talkId: number;

function at(date: Date) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(date);
}

async function vote(voterId: string, isTest: boolean) {
  return prisma.talkFeedback.create({ data: { talkId, voterId, items: ["learned"], isTest } });
}

function setMode(enabled: boolean) {
  return app.inject({ method: "PUT", url: `/api/admin/editions/${editionId}/feedback-test-mode`, payload: { enabled } });
}

beforeAll(async () => {
  await prisma.edition.deleteMany({ where: { year: YEAR } });
  const edition = await prisma.edition.create({ data: { year: YEAR, startDate: START, endDate: START } });
  editionId = edition.id;
  const talk = await prisma.talk.create({
    data: { editionId, slug: "feedback-test-mode", title: "Test mode", description: "", format: "CONFERENCE", language: "fr", publicationStatus: "PUBLISHED" },
  });
  talkId = talk.id;
  app = Fastify();
  await app.register(adminFeedbackRoutes, { prefix: "/api/admin" });
  await app.register(talkFeedbackRoutes, { prefix: "/api" });
});

afterEach(async () => {
  vi.useRealTimers();
  await prisma.talkFeedback.deleteMany({ where: { talkId } });
  await prisma.edition.update({ where: { id: editionId }, data: { feedbackTestMode: false } });
});

afterAll(async () => {
  await prisma.edition.deleteMany({ where: { year: YEAR } });
  await app?.close();
});

describe("feedback test mode (#566)", () => {
  it("should switch on before the event day", async () => {
    const res = await setMode(true);

    expect(res.json()).toEqual({ enabled: true, deleted: 0 });
  });

  it("should refuse to switch on from the event day", async () => {
    at(OPENS_AT);
    const res = await setMode(true);

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("test_mode_too_late");
  });

  it("should report the test votes a switch-off would delete", async () => {
    await setMode(true);
    await vote("11111111-1111-4111-8111-111111111111", true);
    await vote("22222222-2222-4222-8222-222222222222", true);
    const res = await app.inject({ method: "GET", url: `/api/admin/editions/${editionId}/feedback-test-mode` });

    expect(res.json()).toMatchObject({ enabled: true, canEnable: true, testVotes: 2 });
  });

  it("should delete the test votes, and only them, when switched off", async () => {
    await setMode(true);
    await vote("11111111-1111-4111-8111-111111111111", true);
    await vote("33333333-3333-4333-8333-333333333333", false);
    const res = await setMode(false);

    expect(res.json()).toEqual({ enabled: false, deleted: 1 });
    expect(await prisma.talkFeedback.findMany({ where: { talkId }, select: { voterId: true } })).toEqual([
      { voterId: "33333333-3333-4333-8333-333333333333" },
    ]);
  });

  it("should be switched off, test votes wiped, once the event day has come", async () => {
    await setMode(true);
    await vote("11111111-1111-4111-8111-111111111111", true);
    const switchedOff = await disableExpiredTestModes(OPENS_AT);

    expect(switchedOff).toContainEqual({ editionId, deleted: 1 });
    expect((await prisma.edition.findUnique({ where: { id: editionId } }))?.feedbackTestMode).toBe(false);
  });

  it("should leave a test mode alone while the event day has not come", async () => {
    await setMode(true);
    const switchedOff = await disableExpiredTestModes(new Date(OPENS_AT.getTime() - 60 * 1000));

    expect(switchedOff.map((s) => s.editionId)).not.toContain(editionId);
  });
});

describe("voting during the test mode (#566)", () => {
  function castVote(voterId: string) {
    return app.inject({ method: "POST", url: "/api/talks/feedback-test-mode/feedback", payload: { voterId, items: ["fun"] } });
  }

  it("should take a vote before the event day and mark it as a test", async () => {
    await setMode(true);
    const res = await castVote("44444444-4444-4444-8444-444444444444");

    expect(res.statusCode).toBe(201);
    expect((await prisma.talkFeedback.findFirst({ where: { talkId } }))?.isTest).toBe(true);
  });

  it("should still refuse a vote before the event day without the test mode", async () => {
    const res = await castVote("55555555-5555-4555-8555-555555555555");

    expect(res.statusCode).toBe(403);
  });

  it("should let a browser that voted in the trial vote for real on the day", async () => {
    await setMode(true);
    await castVote("66666666-6666-4666-8666-666666666666");
    at(new Date(OPENS_AT.getTime() + 60 * 60 * 1000));
    const res = await castVote("66666666-6666-4666-8666-666666666666");

    expect(res.statusCode).toBe(201);
    expect(await prisma.talkFeedback.findMany({ where: { talkId }, select: { isTest: true } })).toEqual([{ isTest: false }]);
  });
});
