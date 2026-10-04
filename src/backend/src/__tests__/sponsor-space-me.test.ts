process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn().mockResolvedValue({}) }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));
import Fastify, { type FastifyInstance } from "fastify";

import sponsorSpaceRoutes from "../routes/sponsor-space.js";
import { sendPasswordResetEmail } from "../lib/password-reset-email.js";
import { prisma } from "../lib/prisma.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";

// #411 — a sponsor sees which account it is signed in with, and a forgotten
// password brings it back to the partner space, not to the admin wall.

let app: FastifyInstance;
const createdUserIds: string[] = [];

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function createAccount(role: "EDITOR" | "SPONSOR") {
  const email = `me-${role.toLowerCase()}-${stamp()}@example.org`;
  const user = await prisma.user.create({ data: { email, name: `Jane ${role}`, role, emailVerified: true } });
  createdUserIds.push(user.id);
  const key = await generateApiKey(resolveApiKeyEnv());
  await prisma.apiKey.create({
    data: { name: `test-${email}`, prefix: key.prefix, hashedKey: key.hashedKey, userId: user.id },
  });
  return { user, bearer: key.raw };
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.decorateRequest("authContext");
  app.decorateRequest("sponsorAccess");
  await app.register(sponsorSpaceRoutes, { prefix: "/api" });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  if (createdUserIds.length) {
    await prisma.apiKey.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});

describe("GET /api/sponsor-space/me (#411)", () => {
  it("returns the signed-in account's identity", async () => {
    const { user, bearer } = await createAccount("SPONSOR");

    const res = await app.inject({
      method: "GET",
      url: "/api/sponsor-space/me",
      headers: { authorization: `Bearer ${bearer}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: user.id, email: user.email, name: user.name });
  });

  it("answers 401 without a session", async () => {
    const res = await app.inject({ method: "GET", url: "/api/sponsor-space/me" });

    expect(res.statusCode).toBe(401);
  });
});

describe("sendPasswordResetEmail (#411)", () => {
  beforeEach(() => sendMailMock.mockClear());

  const sent = () => sendMailMock.mock.calls[0][0] as { text: string; html: string };

  it("sends a sponsor to the partner space reset page", async () => {
    const { user } = await createAccount("SPONSOR");

    await sendPasswordResetEmail({ user, token: "tok-sponsor" });

    const { text, html } = sent();
    expect(text).toContain("/sponsor/reset-password?token=tok-sponsor");
    expect(html).toContain("/sponsor/reset-password?token=tok-sponsor");
    expect(text).not.toContain("/admin/");
  });

  it("keeps the team on the admin reset page", async () => {
    const { user } = await createAccount("EDITOR");

    await sendPasswordResetEmail({ user, token: "tok-team" });

    expect(sent().text).toContain("/admin/reset-password?token=tok-team");
  });

  // better-auth hands the callback its own user object; the role is read back
  // from the database rather than trusted from it (#362 lost it once).
  it("reads the role from the database, not from the object it is given", async () => {
    const { user } = await createAccount("SPONSOR");

    await sendPasswordResetEmail({ user: { id: user.id, email: user.email, name: user.name }, token: "t" });

    expect(sent().text).toContain("/sponsor/reset-password");
  });
});
