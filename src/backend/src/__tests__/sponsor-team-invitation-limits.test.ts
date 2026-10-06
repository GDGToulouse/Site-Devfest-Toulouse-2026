process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Inviting sends mail; stub SMTP so no test reaches a real server.
const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn().mockResolvedValue({}) }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));

import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";

import sponsorSpaceRoutes from "../routes/sponsor-space.js";
import adminSponsorRoutes from "../routes/admin/sponsors.js";
import { prisma } from "../lib/prisma.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";
import { rateLimitOptions, TEAM_INVITE_RATE_LIMIT_MAX } from "../lib/rate-limit-options.js";

// #524 — inviting a colleague sends mail from the DevFest's SMTP server to any
// address. The body is validated (a malformed one answered 500), and a
// RESPONSABLE gets a per-sponsor budget of invitations, on top of the per-IP
// limit everyone shares. The rate-limit plugin is registered as in server.ts:
// the budget only exists through it.

let app: FastifyInstance;
const created = { userIds: [] as string[], sponsorIds: [] as number[] };

async function createResponsable(label: string) {
  const sponsor = await prisma.sponsor.create({
    data: { name: label, slug: `${label.toLowerCase().replace(/\W+/g, "-")}-${Date.now()}` },
  });
  created.sponsorIds.push(sponsor.id);
  const user = await prisma.user.create({
    data: { email: `${sponsor.slug}@example.org`, name: label, role: "SPONSOR", emailVerified: true },
  });
  created.userIds.push(user.id);
  await prisma.sponsorContact.create({
    data: { sponsorId: sponsor.id, email: user.email, userId: user.id, accessRole: "RESPONSABLE" },
  });
  const key = await generateApiKey(resolveApiKeyEnv());
  await prisma.apiKey.create({
    data: { name: `test-${user.email}`, prefix: key.prefix, hashedKey: key.hashedKey, userId: user.id },
  });
  return { sponsor, headers: { authorization: `Bearer ${key.raw}` } };
}

function invite(sponsorId: number, headers: Record<string, string>, payload?: unknown) {
  return app.inject({ method: "POST", url: `/api/sponsor-space/${sponsorId}/team`, headers, payload: payload as object });
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.decorateRequest("authContext");
  app.decorateRequest("sponsorAccess");
  await app.register(rateLimit, rateLimitOptions);
  await app.register(sponsorSpaceRoutes, { prefix: "/api" });
  await app.register(adminSponsorRoutes, { prefix: "/api/admin" });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.apiKey.deleteMany({ where: { userId: { in: created.userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  await prisma.sponsor.deleteMany({ where: { id: { in: created.sponsorIds } } });
});

describe("Sponsor team invitation — body validation (#524)", () => {
  it("should answer 400 invalid_email, not 500, on a malformed address", async () => {
    const { sponsor, headers } = await createResponsable("Malformed Co");

    const res = await invite(sponsor.id, headers, { email: "not-an-address" });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_email");
  });

  it("should answer 400, not 500, on an email that is not a string or a missing body", async () => {
    const { sponsor, headers } = await createResponsable("Typed Co");

    const notAString = await invite(sponsor.id, headers, { email: 42 });
    const noBody = await invite(sponsor.id, headers);

    expect(notAString.statusCode).toBe(400);
    expect(noBody.statusCode).toBe(400);
  });

  it("should answer 400 on an unknown access role", async () => {
    const { sponsor, headers } = await createResponsable("Role Co");

    const res = await invite(sponsor.id, headers, { email: "someone@example.org", accessRole: "ADMIN" });

    expect(res.statusCode).toBe(400);
  });

  it("should answer 400 on the admin side too, where a missing body crashed", async () => {
    const { sponsor } = await createResponsable("Admin Side Co");

    const noBody = await app.inject({ method: "POST", url: `/api/admin/sponsors/${sponsor.id}/contacts` });
    const malformed = await app.inject({
      method: "POST",
      url: `/api/admin/sponsors/${sponsor.id}/contacts`,
      payload: { email: "nope" },
    });

    expect(noBody.statusCode).toBe(400);
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json().error).toBe("invalid_email");
  });
});

describe("Sponsor team invitation — per-sponsor budget (#524)", () => {
  it("should answer 429 past the budget, without touching another sponsor's", async () => {
    const flooding = await createResponsable("Flooding Co");
    const other = await createResponsable("Quiet Co");
    const stamp = Date.now();

    for (let i = 0; i < TEAM_INVITE_RATE_LIMIT_MAX; i++) {
      await invite(flooding.sponsor.id, flooding.headers, { email: `flood-${stamp}-${i}@example.org` });
    }
    const overBudget = await invite(flooding.sponsor.id, flooding.headers, { email: `flood-${stamp}-x@example.org` });
    const otherSponsor = await invite(other.sponsor.id, other.headers, { email: `quiet-${stamp}@example.org` });

    expect(overBudget.statusCode).toBe(429);
    expect(otherSponsor.statusCode).toBe(201);
  });

  it("should not let anonymous calls spend a sponsor's budget", async () => {
    const { sponsor, headers } = await createResponsable("Anonymous Target Co");

    for (let i = 0; i < TEAM_INVITE_RATE_LIMIT_MAX; i++) {
      await invite(sponsor.id, {}, { email: `anon-${i}@example.org` });
    }
    const real = await invite(sponsor.id, headers, { email: `real-${Date.now()}@example.org` });

    expect(real.statusCode).toBe(201);
  });
});
