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
let messageId: number;
const BROCHURE_URL = "https://example.org/brochure-test.pdf";

beforeAll(async () => {
  const edition = await getSeededEdition();
  editionId = edition.id;
  previousUrl = edition.sponsorBrochureUrl;
  await prisma.edition.update({ where: { id: editionId }, data: { sponsorBrochureUrl: BROCHURE_URL } });

  const msg = await prisma.contactMessage.create({
    data: { firstName: "Bro", lastName: "Chure", email: "bro@example.org", message: "brochure please" },
  });
  messageId = msg.id;
});

afterAll(async () => {
  await prisma.contactMessage.deleteMany({ where: { id: messageId } });
  await prisma.edition.update({ where: { id: editionId }, data: { sponsorBrochureUrl: previousUrl } });
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
