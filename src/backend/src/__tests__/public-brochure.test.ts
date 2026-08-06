// Set the token secret before importing anything that reads it.
process.env.BROCHURE_TOKEN_SECRET = process.env.BROCHURE_TOKEN_SECRET || "test-brochure-secret-32-chars-min-aa";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import brochureRoutes from "../routes/brochure.js";
import { makeToken } from "../lib/brochure-token.js";
import { prisma } from "../lib/prisma.js";
import { getSeededEdition } from "./edition-test-helpers.js";

// #308 — the brochure redirector had no coverage. Locks: bad token → 404,
// valid token → 302 to the edition's brochure URL AND increments the counter,
// and the best-effort nature (a valid token for a missing message still 302s).
async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(brochureRoutes, { prefix: "/api" });
  return app;
}

let editionId: number;
let previousUrl: string | null;
let previousUrlEn: string | null;
let messageId: number;
let englishMessageId: number;
const BROCHURE_URL = "https://example.org/brochure-test.pdf";
const BROCHURE_URL_EN = "https://example.org/brochure-test-en.pdf";

beforeAll(async () => {
  const edition = await getSeededEdition();
  editionId = edition.id;
  previousUrl = edition.sponsorBrochureUrl;
  previousUrlEn = edition.sponsorBrochureUrlEn;
  await prisma.edition.update({
    where: { id: editionId },
    data: { sponsorBrochureUrl: BROCHURE_URL, sponsorBrochureUrlEn: BROCHURE_URL_EN },
  });

  const msg = await prisma.contactMessage.create({
    data: { firstName: "Bro", lastName: "Chure", email: "bro@example.org", message: "brochure please" },
  });
  messageId = msg.id;

  const englishMsg = await prisma.contactMessage.create({
    data: { firstName: "Eng", lastName: "Lish", email: "eng@example.org", message: "brochure please", locale: "en" },
  });
  englishMessageId = englishMsg.id;
});

afterAll(async () => {
  await prisma.contactMessage.deleteMany({ where: { id: { in: [messageId, englishMessageId] } } });
  await prisma.edition.update({
    where: { id: editionId },
    data: { sponsorBrochureUrl: previousUrl, sponsorBrochureUrlEn: previousUrlEn },
  });
});

describe("Public brochure redirector (#308)", () => {
  it("404s on an invalid token", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/brochure/not-a-valid-token" });
    await app.close();
    expect(res.statusCode).toBe(404);
  });

  it("302s to the brochure URL and increments the download counter", async () => {
    const token = makeToken(messageId)!;
    const before = (await prisma.contactMessage.findUnique({ where: { id: messageId } }))!.brochureDownloadCount;

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/brochure/${token}` });
    await app.close();

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(BROCHURE_URL);

    const after = (await prisma.contactMessage.findUnique({ where: { id: messageId } }))!;
    expect(after.brochureDownloadCount).toBe(before + 1);
    expect(after.brochureDownloadedAt).not.toBeNull();
  });

  it("still 302s for a valid token whose message no longer exists (best effort)", async () => {
    // A signed token for an id that has no row: the redirect must still work.
    const ghost = await prisma.contactMessage.create({
      data: { firstName: "Ghost", lastName: "Msg", email: "ghost@example.org", message: "x" },
    });
    const token = makeToken(ghost.id)!;
    await prisma.contactMessage.delete({ where: { id: ghost.id } });

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/brochure/${token}` });
    await app.close();

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(BROCHURE_URL);
  });
});

// #401 — the token carries only the message id, so the language comes from the
// locale stored when the form was submitted. Before the fix every requester got
// the French file.
describe("Brochure language (#401)", () => {
  it("302s to the English brochure for a request made in English", async () => {
    const token = makeToken(englishMessageId)!;

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/brochure/${token}` });
    await app.close();

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(BROCHURE_URL_EN);
  });

  it("falls back to the French brochure when no English one is configured", async () => {
    await prisma.edition.update({ where: { id: editionId }, data: { sponsorBrochureUrlEn: null } });
    const token = makeToken(englishMessageId)!;

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/brochure/${token}` });
    await app.close();

    await prisma.edition.update({ where: { id: editionId }, data: { sponsorBrochureUrlEn: BROCHURE_URL_EN } });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(BROCHURE_URL);
  });

  it("serves the English brochure to a French requester when only the English one exists", async () => {
    await prisma.edition.update({ where: { id: editionId }, data: { sponsorBrochureUrl: null } });
    const token = makeToken(messageId)!;

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/brochure/${token}` });
    await app.close();

    await prisma.edition.update({ where: { id: editionId }, data: { sponsorBrochureUrl: BROCHURE_URL } });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(BROCHURE_URL_EN);
  });

  it("404s when neither brochure is configured", async () => {
    await prisma.edition.update({
      where: { id: editionId },
      data: { sponsorBrochureUrl: null, sponsorBrochureUrlEn: null },
    });
    const token = makeToken(messageId)!;

    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/brochure/${token}` });
    await app.close();

    await prisma.edition.update({
      where: { id: editionId },
      data: { sponsorBrochureUrl: BROCHURE_URL, sponsorBrochureUrlEn: BROCHURE_URL_EN },
    });

    expect(res.statusCode).toBe(404);
  });
});
