import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../server.js";
import { prisma } from "../lib/prisma.js";
import { feedbackWindow } from "../lib/talk-feedback.js";
import { getFeaturedEdition } from "../routes/editions.js";

// #564 — the audience votes on a session of the featured edition, once per
// browser, the day of the event and the next. Read-only on the shared fixtures:
// the tests vote on a published talk the seed already has and delete their own
// votes, keyed by the voter ids they generated.

let app: FastifyInstance;
let slug: string;
let talkId: number;
let window: { opensAt: Date; closesAt: Date };
const voters: string[] = [];

function voter(): string {
  const id = randomUUID();
  voters.push(id);
  return id;
}

function at(date: Date) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(date);
}

const duringEvent = () => at(new Date(window.opensAt.getTime() + 10 * 60 * 60 * 1000));

function vote(voterId: string, items: string[] = ["learned"], talkSlug = slug) {
  return app.inject({ method: "POST", url: `/api/talks/${talkSlug}/feedback`, payload: { voterId, items } });
}

beforeAll(async () => {
  app = await buildServer();
  const edition = await getFeaturedEdition();
  if (!edition) throw new Error("the seed has no featured edition");
  const talk = await prisma.talk.findFirst({
    where: { editionId: edition.id, publicationStatus: "PUBLISHED", deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!talk) throw new Error("the featured edition has no published talk");
  ({ id: talkId, slug } = talk);
  const found = feedbackWindow(edition);
  if (!found) throw new Error("the featured edition has no date");
  window = found;
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await prisma.talkFeedback.deleteMany({ where: { voterId: { in: voters } } });
  await app.close();
});

describe("POST /api/talks/:slug/feedback (#564)", () => {
  it("should refuse a vote before the event", async () => {
    at(new Date(window.opensAt.getTime() - 60 * 1000));
    const res = await vote(voter());

    expect(res.statusCode).toBe(403);
  });

  it("should take a vote on the day of the event", async () => {
    duringEvent();
    const id = voter();
    const res = await vote(id, ["learned", "notClear"]);

    expect(res.statusCode).toBe(201);
    const stored = await prisma.talkFeedback.findUnique({ where: { talkId_voterId: { talkId, voterId: id } } });
    expect(stored?.items).toEqual(["learned", "notClear"]);
  });

  it("should refuse a second vote from the same browser", async () => {
    duringEvent();
    const id = voter();
    await vote(id);
    const res = await vote(id, ["fun"]);

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("already_voted");
  });

  it("should refuse an appreciation outside the fixed list", async () => {
    duringEvent();
    const res = await vote(voter(), ["boring"]);

    expect(res.statusCode).toBe(400);
  });

  it("should refuse a vote once voting is over", async () => {
    at(window.closesAt);
    const res = await vote(voter());

    expect(res.statusCode).toBe(403);
  });

  it("should answer 404 for a session that is not published", async () => {
    duringEvent();
    const res = await vote(voter(), ["fun"], "no-such-session");

    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/talks/:slug/feedback/message (#564)", () => {
  function message(voterId: string, text = "Merci, très clair !") {
    return app.inject({ method: "POST", url: `/api/talks/${slug}/feedback/message`, payload: { voterId, message: text } });
  }

  it("should keep the private message of a browser that voted", async () => {
    duringEvent();
    const id = voter();
    await vote(id);
    const res = await message(id);

    expect(res.statusCode).toBe(201);
    const stored = await prisma.talkFeedback.findUnique({ where: { talkId_voterId: { talkId, voterId: id } } });
    expect(stored?.message).toBe("Merci, très clair !");
  });

  it("should refuse a message from a browser that has not voted", async () => {
    duringEvent();
    const res = await message(voter());

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("no_vote");
  });

  it("should refuse a second message", async () => {
    duringEvent();
    const id = voter();
    await vote(id);
    await message(id);
    const res = await message(id, "Encore un");

    expect(res.statusCode).toBe(409);
  });
});

describe("GET /api/talks/:slug/feedback (#564)", () => {
  function status(voterId?: string) {
    return app.inject({ method: "GET", url: `/api/talks/${slug}/feedback${voterId ? `?voterId=${voterId}` : ""}` });
  }

  it("should say voting has not started, and nothing else, before the event", async () => {
    at(new Date(window.opensAt.getTime() - 60 * 1000));
    const res = await status();

    expect(res.json()).toEqual({ phase: "upcoming", isTest: false, hasVoted: false, hasMessage: false, trend: null });
  });

  it("should not show the trend to a browser that has not voted yet", async () => {
    duringEvent();
    const res = await status(voter());

    expect(res.json()).toMatchObject({ phase: "open", hasVoted: false, trend: null });
  });

  it("should show the trend to a browser that voted, once there are five votes", async () => {
    duringEvent();
    const ids = [voter(), voter(), voter(), voter(), voter()];
    for (const id of ids) await vote(id, ["learned", "tooComplex"]);
    const res = await status(ids[0]);

    expect(res.json().hasVoted).toBe(true);
    expect(res.json().trend).toContainEqual({ code: "learned", percent: expect.any(Number) });
  });

  it("should never expose a negative appreciation nor a message", async () => {
    duringEvent();
    const id = voter();
    await vote(id, ["tooComplex"]);
    const body = JSON.stringify((await status(id)).json());

    expect(body).not.toContain("tooComplex");
    expect(body).not.toContain("Merci");
  });
});
