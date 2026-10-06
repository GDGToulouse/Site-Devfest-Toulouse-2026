process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Inviting a user sends mail; stub SMTP so no test reaches a real server.
const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn().mockResolvedValue({}) }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));
import Fastify, { type FastifyInstance } from "fastify";

import adminUserRoutes from "../routes/admin/users.js";
import { prisma } from "../lib/prisma.js";

// #500 — a sponsor contact must never be promoted into the back-office. EDITOR
// is the column default and opens it, so every assertion reads the role STORED
// in the database, not the HTTP status alone (.claude/rules/security.md).

let app: FastifyInstance;

const created = {
  userIds: [] as string[],
  sponsorIds: [] as number[],
};

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function createUser(role: "ADMIN" | "EDITOR" | "SPONSOR") {
  const email = `users-${role.toLowerCase()}-${stamp()}@example.org`;
  const user = await prisma.user.create({ data: { email, name: email, role, emailVerified: true } });
  created.userIds.push(user.id);
  return user;
}

async function createSponsorContact(userId: string, email: string, accessRole: "RESPONSABLE" | "STAND") {
  const sponsor = await prisma.sponsor.create({ data: { name: `Users Co ${stamp()}`, slug: `users-co-${stamp()}` } });
  created.sponsorIds.push(sponsor.id);
  await prisma.sponsorContact.create({ data: { sponsorId: sponsor.id, email, userId, accessRole } });
  return sponsor;
}

async function storedRole(id: string) {
  return (await prisma.user.findUniqueOrThrow({ where: { id } })).role;
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.decorateRequest("adminUser");
  await app.register(adminUserRoutes, { prefix: "/api/admin" });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  if (created.sponsorIds.length) {
    await prisma.sponsor.deleteMany({ where: { id: { in: created.sponsorIds } } });
  }
  if (created.userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  }
});

describe("GET /api/admin/users (#500)", () => {
  it("returns a sponsor contact as SPONSOR, with the companies it is attached to", async () => {
    const user = await createUser("SPONSOR");
    const acme = await createSponsorContact(user.id, user.email, "RESPONSABLE");
    const beta = await createSponsorContact(user.id, user.email, "STAND");

    const res = await app.inject({ method: "GET", url: "/api/admin/users" });

    expect(res.statusCode).toBe(200);
    const row = res.json().find((u: { id: string }) => u.id === user.id);
    expect(row.role).toBe("SPONSOR");
    expect(row.sponsors).toEqual(
      expect.arrayContaining([
        { id: acme.id, name: acme.name, accessRole: "RESPONSABLE" },
        { id: beta.id, name: beta.name, accessRole: "STAND" },
      ]),
    );
  });

  it("returns an empty company list for a team member", async () => {
    const user = await createUser("EDITOR");

    const res = await app.inject({ method: "GET", url: "/api/admin/users" });

    const row = res.json().find((u: { id: string }) => u.id === user.id);
    expect(row.sponsors).toEqual([]);
  });
});

describe("PUT /api/admin/users/:id — role (#500)", () => {
  it("refuses to give a sponsor contact a back-office role", async () => {
    const user = await createUser("SPONSOR");

    const res = await app.inject({ method: "PUT", url: `/api/admin/users/${user.id}`, payload: { role: "EDITOR" } });

    expect(res.statusCode).toBe(409);
    expect(await storedRole(user.id)).toBe("SPONSOR");
  });

  it("rejects a role outside ADMIN and EDITOR", async () => {
    const user = await createUser("EDITOR");

    const asSponsor = await app.inject({ method: "PUT", url: `/api/admin/users/${user.id}`, payload: { role: "SPONSOR" } });
    const unknown = await app.inject({ method: "PUT", url: `/api/admin/users/${user.id}`, payload: { role: "SUPERUSER" } });

    expect(asSponsor.statusCode).toBe(400);
    expect(unknown.statusCode).toBe(400);
    expect(await storedRole(user.id)).toBe("EDITOR");
  });

  it("still changes a team member's role", async () => {
    const user = await createUser("EDITOR");

    const res = await app.inject({ method: "PUT", url: `/api/admin/users/${user.id}`, payload: { role: "ADMIN" } });

    expect(res.statusCode).toBe(200);
    expect(await storedRole(user.id)).toBe("ADMIN");
  });
});

describe("POST /api/admin/users — role (#500)", () => {
  it("refuses to invite a user with a role outside ADMIN and EDITOR", async () => {
    const email = `users-invite-${stamp()}@example.org`;

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/users",
      payload: { email, name: "Invité", role: "SPONSOR" },
    });

    expect(res.statusCode).toBe(400);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });
});
